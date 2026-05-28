import { useState, useEffect, useMemo } from 'react';
import { HiPlus, HiPencil, HiTrash, HiChevronRight, HiOutlineShieldCheck } from 'react-icons/hi';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { formatCurrency } from '../../utils/currency';
import { formatDate, getDaysRemaining, getStatusBadge } from '../../utils/helpers';
import Modal from '../common/Modal';
import ConfirmDialog from '../common/ConfirmDialog';
import './Savings.css';

const INITIAL_FORM = {
  goalName: '',
  targetAmount: '',
  currentAmount: '',
  deadline: '',
  status: 'active',
};

function SavingsPage() {
  const { currency } = useAuth();
  const [savings, setSavings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Add funds
  const [fundsModalOpen, setFundsModalOpen] = useState(false);
  const [fundsTarget, setFundsTarget] = useState(null);
  const [fundsAmount, setFundsAmount] = useState('');
  const [addingFunds, setAddingFunds] = useState(false);

  // Completed section toggle
  const [showCompleted, setShowCompleted] = useState(false);

  // Celebration
  const [celebrateId, setCelebrateId] = useState(null);

  useEffect(() => {
    fetchSavings();
  }, []);

  const fetchSavings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/savings');
      setSavings(res.data.data);
    } catch (err) {
      toast.error('Failed to load savings');
    } finally {
      setLoading(false);
    }
  };

  const activeGoals = useMemo(() => savings.filter((s) => s.status !== 'completed'), [savings]);
  const completedGoals = useMemo(() => savings.filter((s) => s.status === 'completed'), [savings]);

  const openAdd = () => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setModalOpen(true);
  };

  const openEdit = (goal) => {
    setEditingId(goal.id);
    setForm({
      goalName: goal.goal_name || '',
      targetAmount: goal.target_amount || '',
      currentAmount: goal.current_amount || '',
      deadline: goal.deadline ? goal.deadline.split('T')[0] : '',
      status: goal.status || 'active',
    });
    setModalOpen(true);
  };

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.goalName || !form.targetAmount) {
      toast.error('Please fill in required fields');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        goal_name: form.goalName,
        target_amount: Number(form.targetAmount),
        current_amount: Number(form.currentAmount) || 0,
        deadline: form.deadline ? form.deadline : null,
        status: form.status,
        notes: form.notes || null
      };
      if (editingId) {
        await api.put(`/savings/${editingId}`, payload);
        toast.success('Goal updated');
      } else {
        await api.post('/savings', payload);
        toast.success('Goal created');
      }
      setModalOpen(false);
      fetchSavings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save goal');
    } finally {
      setSaving(false);
    }
  };

  const handleAddFunds = async () => {
    if (!fundsAmount || Number(fundsAmount) <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setAddingFunds(true);
    try {
      const newAmount = (fundsTarget.current_amount || 0) + Number(fundsAmount);
      await api.put(`/savings/${fundsTarget.id}/add-funds`, {
        amount: Number(fundsAmount)
      });
      if (newAmount >= fundsTarget.target_amount) {
        setCelebrateId(fundsTarget.id);
        toast.success('🎉 Goal completed! Congratulations!');
        setTimeout(() => setCelebrateId(null), 3000);
      } else {
        toast.success('Funds added successfully');
      }
      setFundsModalOpen(false);
      setFundsAmount('');
      fetchSavings();
    } catch (err) {
      toast.error('Failed to add funds');
    } finally {
      setAddingFunds(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.delete(`/savings/${deleteId}`);
      toast.success('Goal deleted');
      setDeleteId(null);
      fetchSavings();
    } catch (err) {
      toast.error('Failed to delete goal');
    } finally {
      setDeleting(false);
    }
  };

  const getProgress = (current, target) => {
    if (!target) return 0;
    return Math.min((current / target) * 100, 100);
  };

  const CelebrationEffect = () => {
    const particles = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      color: ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#ef4444'][i % 6],
      left: `${Math.random() * 100}%`,
      animationDelay: `${Math.random() * 0.5}s`,
    }));
    return (
      <div className="savings-celebration">
        {particles.map((p) => (
          <div
            key={p.id}
            className="celebration-particle"
            style={{
              background: p.color,
              left: p.left,
              animationDelay: p.animationDelay,
            }}
          />
        ))}
      </div>
    );
  };

  const renderGoalCard = (goal) => {
    const progress = getProgress(goal.current_amount, goal.target_amount);
    const daysLeft = getDaysRemaining(goal.deadline);
    const isComplete = progress >= 100;

    return (
      <div className="glass-card savings-card" key={goal.id}>
        {celebrateId === goal.id && <CelebrationEffect />}

        <div className="savings-card-header">
          <h3 className="savings-card-name">{goal.goal_name}</h3>
          <span className={`badge ${getStatusBadge(goal.status)}`}>
            {goal.status}
          </span>
        </div>

        {/* Progress */}
        <div className="savings-progress">
          <div className="savings-progress-header">
            <span className="savings-progress-amounts">
              <strong>{formatCurrency(goal.current_amount || 0, currency)}</strong>
              {' / '}
              {formatCurrency(goal.target_amount, currency)}
            </span>
            <span className="savings-progress-percent">{progress.toFixed(1)}%</span>
          </div>
          <div className="savings-progress-bar">
            <div
              className={`savings-progress-fill ${isComplete ? 'complete' : ''}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Deadline */}
        {goal.deadline && (
          <div className="savings-deadline">
            <span>Deadline: {formatDate(goal.deadline)}</span>
            <span className="savings-countdown" style={{
              color: daysLeft !== null && daysLeft < 0 ? 'var(--color-danger)' :
                     daysLeft !== null && daysLeft <= 30 ? 'var(--color-warning)' :
                     'var(--color-success)'
            }}>
              {daysLeft !== null
                ? daysLeft < 0
                  ? `${Math.abs(daysLeft)} days overdue`
                  : daysLeft === 0
                  ? 'Due today'
                  : `${daysLeft} days left`
                : ''}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="savings-card-actions">
          {!isComplete && goal.status !== 'cancelled' && (
            <button
              className="btn btn-success btn-sm savings-add-funds-btn"
              onClick={() => {
                setFundsTarget(goal);
                setFundsAmount('');
                setFundsModalOpen(true);
              }}
            >
              <HiPlus /> Add Funds
            </button>
          )}
          <button className="btn btn-ghost btn-icon" onClick={() => openEdit(goal)} title="Edit">
            <HiPencil />
          </button>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setDeleteId(goal.id)}
            title="Delete"
            style={{ color: 'var(--color-danger)' }}
          >
            <HiTrash />
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div>
        <div className="page-header"><div className="skeleton skeleton-title" /></div>
        <div className="savings-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton skeleton-card" style={{ height: '200px' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Savings Goals</h1>
          <p className="page-subtitle">Track progress toward your financial goals</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <HiPlus /> New Goal
        </button>
      </div>

      {/* Active Goals */}
      {activeGoals.length === 0 && completedGoals.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><HiOutlineShieldCheck /></div>
          <h3 className="empty-state-title">No savings goals</h3>
          <p className="empty-state-text">
            Set your first savings goal and start building your future!
          </p>
        </div>
      ) : (
        <div className="savings-grid">
          {activeGoals.map(renderGoalCard)}
        </div>
      )}

      {/* Completed Goals */}
      {completedGoals.length > 0 && (
        <div className="savings-completed-section">
          <button
            className={`savings-completed-toggle ${showCompleted ? 'open' : ''}`}
            onClick={() => setShowCompleted((prev) => !prev)}
          >
            <HiChevronRight />
            Completed Goals ({completedGoals.length})
          </button>
          {showCompleted && (
            <div className="savings-grid">
              {completedGoals.map(renderGoalCard)}
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Goal' : 'New Savings Goal'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button
              className={`btn btn-primary ${saving ? 'btn-loading' : ''}`}
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? '' : editingId ? 'Update' : 'Create'}
            </button>
          </>
        }
      >
        <form className="savings-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Goal Name *</label>
            <input
              className="form-input"
              name="goalName"
              value={form.goalName}
              onChange={handleChange}
              placeholder="e.g. Emergency Fund"
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Target Amount *</label>
              <input
                className="form-input"
                name="targetAmount"
                type="number"
                step="0.01"
                min="0"
                value={form.targetAmount}
                onChange={handleChange}
                placeholder="0.00"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Current Amount</label>
              <input
                className="form-input"
                name="currentAmount"
                type="number"
                step="0.01"
                min="0"
                value={form.currentAmount}
                onChange={handleChange}
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Deadline</label>
              <input
                className="form-input"
                name="deadline"
                type="date"
                value={form.deadline}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                className="form-select"
                name="status"
                value={form.status}
                onChange={handleChange}
              >
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </form>
      </Modal>

      {/* Add Funds Modal */}
      <Modal
        isOpen={fundsModalOpen}
        onClose={() => setFundsModalOpen(false)}
        title={`Add Funds — ${fundsTarget?.goalName || ''}`}
        maxWidth="400px"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setFundsModalOpen(false)}>Cancel</button>
            <button
              className={`btn btn-success ${addingFunds ? 'btn-loading' : ''}`}
              onClick={handleAddFunds}
              disabled={addingFunds}
            >
              {addingFunds ? '' : 'Add Funds'}
            </button>
          </>
        }
      >
        <div className="add-funds-form">
          {fundsTarget && (
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
              Current: {formatCurrency(fundsTarget.currentAmount || 0, currency)} /{' '}
              {formatCurrency(fundsTarget.targetAmount, currency)}
            </p>
          )}
          <div className="form-group">
            <label className="form-label">Amount to Add</label>
            <input
              className="form-input"
              type="number"
              step="0.01"
              min="0"
              value={fundsAmount}
              onChange={(e) => setFundsAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Goal?"
        message="This will permanently remove this savings goal."
        loading={deleting}
      />
    </div>
  );
}

export default SavingsPage;
