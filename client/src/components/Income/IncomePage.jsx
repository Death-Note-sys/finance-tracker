import { useState, useEffect, useMemo } from 'react';
import { HiPlus, HiPencil, HiTrash, HiOutlineCash } from 'react-icons/hi';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { formatCurrency } from '../../utils/currency';
import { formatDate, INCOME_FREQUENCIES } from '../../utils/helpers';
import Modal from '../common/Modal';
import ConfirmDialog from '../common/ConfirmDialog';
import './Income.css';

const INITIAL_FORM = {
  source: '',
  amount: '',
  frequency: 'monthly',
  date: new Date().toISOString().split('T')[0],
  notes: '',
};

function IncomePage() {
  const { currency } = useAuth();
  const [incomes, setIncomes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchIncomes();
  }, []);

  const fetchIncomes = async () => {
    setLoading(true);
    try {
      const res = await api.get('/income');
      setIncomes(res.data.data);
    } catch (err) {
      toast.error('Failed to load income');
    } finally {
      setLoading(false);
    }
  };

  const totalIncome = useMemo(() => {
    return incomes.reduce((sum, inc) => sum + (inc.amount || 0), 0);
  }, [incomes]);

  const openAdd = () => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setModalOpen(true);
  };

  const openEdit = (income) => {
    setEditingId(income.id);
    setForm({
      source: income.source || '',
      amount: income.amount || '',
      frequency: income.frequency || 'monthly',
      date: income.income_date ? income.income_date.split('T')[0] : '',
      notes: income.notes || '',
    });
    setModalOpen(true);
  };

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.source || !form.amount || !form.date) {
      toast.error('Please fill in required fields');
      return;
    }
    if (Number(form.amount) <= 0) {
      toast.error('Amount must be positive');
      return;
    }
    setSaving(true);
    try {
      const payload = { 
        ...form, 
        source_name: form.source, 
        amount: Number(form.amount), 
        income_date: form.date,
        notes: form.notes || null
      };
      if (editingId) {
        await api.put(`/income/${editingId}`, payload);
        toast.success('Income updated');
      } else {
        await api.post('/income', payload);
        toast.success('Income added');
      }
      setModalOpen(false);
      fetchIncomes();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save income');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.delete(`/income/${deleteId}`);
      toast.success('Income deleted');
      setDeleteId(null);
      fetchIncomes();
    } catch (err) {
      toast.error('Failed to delete income');
    } finally {
      setDeleting(false);
    }
  };

  const getFreqClass = (freq) => {
    const map = {
      'one-time': 'freq-one-time',
      daily: 'freq-daily',
      weekly: 'freq-weekly',
      monthly: 'freq-monthly',
      yearly: 'freq-yearly',
    };
    return map[(freq || '').toLowerCase()] || 'freq-one-time';
  };

  if (loading) {
    return (
      <div>
        <div className="page-header"><div className="skeleton skeleton-title" /></div>
        <div className="income-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton skeleton-card" style={{ height: '160px' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Income Sources</h1>
          <p className="page-subtitle">Manage your income streams</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <HiPlus /> Add Income
        </button>
      </div>

      {/* Total */}
      <div className="income-total">
        <div className="glass-card-static income-total-card">
          <div>
            <p className="income-total-label">Total Income</p>
            <p className="income-total-amount">{formatCurrency(totalIncome, currency)}</p>
          </div>
        </div>
      </div>

      {/* Income list */}
      {incomes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><HiOutlineCash /></div>
          <h3 className="empty-state-title">No income sources</h3>
          <p className="empty-state-text">Start tracking your income by clicking &apos;Add Income&apos;.</p>
        </div>
      ) : (
        <div className="income-grid">
          {incomes.map((income) => (
            <div className="glass-card income-card" key={income.id}>
              <div className="income-card-top">
                <h3 className="income-card-source">{income.source}</h3>
                <span className="income-card-amount">
                  +{formatCurrency(income.amount, currency)}
                </span>
              </div>
              <div className="income-card-meta">
                <span className={`freq-badge ${getFreqClass(income.frequency)}`}>
                  {income.frequency || 'One-time'}
                </span>
                <span className="income-card-date">{formatDate(income.income_date)}</span>
              </div>
              {income.notes && (
                <p className="income-card-notes">{income.notes}</p>
              )}
              <div className="income-card-actions">
                <button className="btn btn-ghost btn-icon" onClick={() => openEdit(income)} title="Edit">
                  <HiPencil />
                </button>
                <button
                  className="btn btn-ghost btn-icon"
                  onClick={() => setDeleteId(income.id)}
                  title="Delete"
                  style={{ color: 'var(--color-danger)' }}
                >
                  <HiTrash />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Income' : 'Add Income'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button
              className={`btn btn-primary ${saving ? 'btn-loading' : ''}`}
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? '' : editingId ? 'Update' : 'Add'}
            </button>
          </>
        }
      >
        <form className="income-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Source Name *</label>
            <input
              className="form-input"
              name="source"
              value={form.source}
              onChange={handleChange}
              placeholder="e.g. Freelance work"
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Amount *</label>
              <input
                className="form-input"
                name="amount"
                type="number"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={handleChange}
                placeholder="0.00"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Frequency</label>
              <select
                className="form-select"
                name="frequency"
                value={form.frequency}
                onChange={handleChange}
              >
                {INCOME_FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Date *</label>
            <input
              className="form-input"
              name="date"
              type="date"
              value={form.date}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea
              className="form-textarea"
              name="notes"
              value={form.notes}
              onChange={handleChange}
              placeholder="Optional notes..."
              rows={3}
            />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Income?"
        message="This will permanently remove this income entry."
        loading={deleting}
      />
    </div>
  );
}

export default IncomePage;
