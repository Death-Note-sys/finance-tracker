import { useState, useEffect, useMemo } from 'react';
import { HiPlus, HiPencil, HiTrash, HiOutlineCreditCard } from 'react-icons/hi';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { formatCurrency } from '../../utils/currency';
import { formatDate, getCategoryColor, getCategoryIcon, EXPENSE_CATEGORIES } from '../../utils/helpers';
import Modal from '../common/Modal';
import ConfirmDialog from '../common/ConfirmDialog';
import './Expenses.css';

const INITIAL_FORM = {
  title: '',
  amount: '',
  category: 'Food',
  date: new Date().toISOString().split('T')[0],
  notes: '',
};

function ExpensesPage() {
  const { currency } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Filters
  const [filterMonth, setFilterMonth] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const res = await api.get('/expenses');
      setExpenses(res.data.data);
    } catch (err) {
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      if (filterCategory && exp.category?.toLowerCase() !== filterCategory.toLowerCase()) return false;
      if (filterMonth) {
        const expMonth = exp.expense_date?.slice(0, 7);
        if (expMonth !== filterMonth) return false;
      }
      return true;
    });
  }, [expenses, filterCategory, filterMonth]);

  const monthlyTotal = useMemo(() => {
    return filteredExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  }, [filteredExpenses]);

  const openAdd = () => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setModalOpen(true);
  };

  const openEdit = (expense) => {
    setEditingId(expense.id);
    setForm({
      title: expense.title || '',
      amount: expense.amount || '',
      category: expense.category || 'Food',
      date: expense.expense_date ? expense.expense_date.split('T')[0] : '',
      notes: expense.notes || '',
    });
    setModalOpen(true);
  };

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.amount || !form.date) {
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
        amount: Number(form.amount), 
        category: form.category.toLowerCase(),
        expense_date: form.date,
        notes: form.notes || null 
      };
      if (editingId) {
        await api.put(`/expenses/${editingId}`, payload);
        toast.success('Expense updated');
      } else {
        await api.post('/expenses', payload);
        toast.success('Expense added');
      }
      setModalOpen(false);
      fetchExpenses();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save expense');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.delete(`/expenses/${deleteId}`);
      toast.success('Expense deleted');
      setDeleteId(null);
      fetchExpenses();
    } catch (err) {
      toast.error('Failed to delete expense');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <div className="skeleton skeleton-title" />
        </div>
        <div className="expenses-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton skeleton-card" style={{ height: '160px' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Expenses</h1>
          <p className="page-subtitle">Track and manage your spending</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <HiPlus /> Add Expense
        </button>
      </div>

      {/* Filters */}
      <div className="expenses-filters">
        <input
          type="month"
          className="expenses-filter-input"
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
        />
        <select
          className="expenses-filter-input"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="">All Categories</option>
          {EXPENSE_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <span className="expenses-monthly-total">
          Total: {formatCurrency(monthlyTotal, currency)}
        </span>
      </div>

      {/* Expenses list */}
      {filteredExpenses.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><HiOutlineCreditCard /></div>
          <h3 className="empty-state-title">No expenses found</h3>
          <p className="empty-state-text">
            {expenses.length === 0
              ? "Start tracking your expenses by clicking 'Add Expense'."
              : 'No expenses match the current filters.'}
          </p>
        </div>
      ) : (
        <div className="expenses-grid">
          {filteredExpenses.map((expense) => (
            <div className="glass-card expense-card" key={expense.id}>
              <div className="expense-card-top">
                <div>
                  <h3 className="expense-card-title">{expense.title}</h3>
                </div>
                <span className="expense-card-amount">
                  −{formatCurrency(expense.amount, currency)}
                </span>
              </div>
              <div className="expense-card-meta">
                <span
                  className="category-badge"
                  title={expense.category}
                >
                  <span
                    className="category-badge-dot"
                    style={{ background: getCategoryColor(expense.category) }}
                  />
                  {getCategoryIcon(expense.category)} {expense.category}
                </span>
                <span className="expense-card-date">{formatDate(expense.expense_date)}</span>
              </div>
              {expense.notes && (
                <p className="expense-card-notes">{expense.notes}</p>
              )}
              <div className="expense-card-actions">
                <button className="btn btn-ghost btn-icon" onClick={() => openEdit(expense)} title="Edit">
                  <HiPencil />
                </button>
                <button
                  className="btn btn-ghost btn-icon"
                  onClick={() => setDeleteId(expense.id)}
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
        title={editingId ? 'Edit Expense' : 'Add Expense'}
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
        <form className="expense-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Title *</label>
            <input
              className="form-input"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="e.g. Grocery shopping"
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
              <label className="form-label">Category</label>
              <select
                className="form-select"
                name="category"
                value={form.category}
                onChange={handleChange}
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
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

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Expense?"
        message="This will permanently remove this expense entry. This action cannot be undone."
        loading={deleting}
      />
    </div>
  );
}

export default ExpensesPage;
