import React, { useState, useEffect } from 'react';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineCheck } from 'react-icons/hi';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/currency';
import { formatDate, getUrgencyColor, getStatusBadge } from '../../utils/helpers';
import Modal from '../common/Modal';
import ConfirmDialog from '../common/ConfirmDialog';
import './Borrowing.css';

const BorrowingPage = () => {
  const { user } = useAuth();
  const [borrowings, setBorrowings] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('lent'); // 'lent' or 'borrowed'
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [currentEntry, setCurrentEntry] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    person_name: '',
    type: 'lent',
    amount: '',
    interest_rate: '0',
    interest_type: 'none',
    borrow_date: new Date().toISOString().split('T')[0],
    due_date: '',
    notes: ''
  });
  
  const [settleAmount, setSettleAmount] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [borrowingsRes, summaryRes] = await Promise.all([
        api.get('/borrowings'),
        api.get('/borrowings/summary')
      ]);
      setBorrowings(borrowingsRes.data.data);
      setSummary(summaryRes.data.data);
    } catch (error) {
      toast.error('Failed to load borrowing data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (entry = null) => {
    if (entry) {
      setCurrentEntry(entry);
      setFormData({
        person_name: entry.person_name,
        type: entry.type,
        amount: entry.amount,
        interest_rate: entry.interest_rate,
        interest_type: entry.interest_type,
        borrow_date: entry.borrow_date.split('T')[0],
        due_date: entry.due_date ? entry.due_date.split('T')[0] : '',
        notes: entry.notes || ''
      });
    } else {
      setCurrentEntry(null);
      setFormData({
        person_name: '',
        type: activeTab,
        amount: '',
        interest_rate: '0',
        interest_type: 'none',
        borrow_date: new Date().toISOString().split('T')[0],
        due_date: '',
        notes: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleOpenSettleModal = (entry) => {
    setCurrentEntry(entry);
    setSettleAmount((parseFloat(entry.amount) + parseFloat(entry.interest_accrued || 0) - parseFloat(entry.amount_settled || 0)).toString());
    setIsSettleModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        amount: Number(formData.amount),
        interest_rate: Number(formData.interest_rate) || 0,
        due_date: formData.due_date ? formData.due_date : null,
        notes: formData.notes || null
      };

      if (currentEntry) {
        await api.put(`/borrowings/${currentEntry.id}`, payload);
        toast.success('Entry updated successfully');
      } else {
        await api.post('/borrowings', payload);
        toast.success('Entry added successfully');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Action failed');
    }
  };

  const handleSettle = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/borrowings/${currentEntry.id}/settle`, { amount_to_settle: settleAmount });
      toast.success('Payment settled successfully');
      setIsSettleModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Settlement failed');
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/borrowings/${deleteId}`);
      toast.success('Entry deleted');
      setIsConfirmOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to delete entry');
    }
  };

  const filteredBorrowings = borrowings.filter(b => b.type === activeTab);

  if (loading) {
    return <div className="loading-state">Loading borrowing data...</div>;
  }

  return (
    <div className="borrowing-container">
      <div className="borrowing-header">
        <h2>Borrowing & Lending</h2>
        <button className="btn btn-primary" onClick={() => handleOpenModal()}>
          <HiOutlinePlus /> Add Entry
        </button>
      </div>

      {summary && (
        <div className="summary-bar">
          <div className="summary-card glass-card">
            <span>Total Lent</span>
            <h3 style={{ color: 'var(--secondary)' }}>
              {formatCurrency(summary.total_lent, user?.preferred_currency)}
            </h3>
          </div>
          <div className="summary-card glass-card">
            <span>Total Borrowed</span>
            <h3 style={{ color: 'var(--warning)' }}>
              {formatCurrency(summary.total_borrowed, user?.preferred_currency)}
            </h3>
          </div>
          <div className="summary-card glass-card">
            <span>Net Balance</span>
            <h3 style={{ color: summary.net_balance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {formatCurrency(Math.abs(summary.net_balance), user?.preferred_currency)}
              {summary.net_balance >= 0 ? ' (Owed to you)' : ' (You owe)'}
            </h3>
          </div>
        </div>
      )}

      <div className="tabs">
        <button 
          className={`tab-btn ${activeTab === 'lent' ? 'active' : ''}`}
          onClick={() => setActiveTab('lent')}
        >
          Money I Lent
        </button>
        <button 
          className={`tab-btn ${activeTab === 'borrowed' ? 'active' : ''}`}
          onClick={() => setActiveTab('borrowed')}
        >
          Money I Borrowed
        </button>
      </div>

      <div className="borrowing-grid">
        {filteredBorrowings.length === 0 ? (
          <div className="empty-state" style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No records found for this category.
          </div>
        ) : (
          filteredBorrowings.map((item, index) => {
            const totalDue = parseFloat(item.amount) + parseFloat(item.interest_accrued || 0);
            const remaining = totalDue - parseFloat(item.amount_settled || 0);
            
            return (
              <div key={item.id} className="borrowing-card glass-card" style={{ animationDelay: `${index * 0.1}s` }}>
                <div className="borrowing-card-header">
                  <h3>{item.person_name}</h3>
                  {getStatusBadge(item.status)}
                </div>
                
                <div className="borrowing-details">
                  <div className="detail-item">
                    <span>Principal</span>
                    <span>{formatCurrency(item.amount, item.currency || user?.preferred_currency)}</span>
                  </div>
                  {item.interest_type !== 'none' && (
                    <div className="detail-item">
                      <span>Interest ({item.interest_rate}%)</span>
                      <span style={{ color: 'var(--warning)' }}>
                        +{formatCurrency(item.interest_accrued, item.currency || user?.preferred_currency)}
                      </span>
                    </div>
                  )}
                  <div className="detail-item">
                    <span>Total Due</span>
                    <span>{formatCurrency(totalDue, item.currency || user?.preferred_currency)}</span>
                  </div>
                  <div className="detail-item">
                    <span>Remaining</span>
                    <span style={{ color: remaining > 0 ? 'var(--danger)' : 'var(--success)' }}>
                      {formatCurrency(remaining, item.currency || user?.preferred_currency)}
                    </span>
                  </div>
                </div>

                {item.due_date && item.status !== 'settled' && (
                  <div className="urgency-indicator">
                    <div className={`urgency-dot ${item.urgency_level || 'safe'}`}></div>
                    <span>Due: {formatDate(item.due_date)}</span>
                  </div>
                )}

                <div className="borrowing-actions">
                  <button 
                    className="btn btn-outline btn-sm" 
                    onClick={() => handleOpenSettleModal(item)}
                    disabled={item.status === 'settled'}
                  >
                    <HiOutlineCheck /> Settle
                  </button>
                  <div className="action-buttons">
                    <button className="icon-btn" onClick={() => handleOpenModal(item)}>
                      <HiOutlinePencil />
                    </button>
                    <button className="icon-btn danger" onClick={() => { setDeleteId(item.id); setIsConfirmOpen(true); }}>
                      <HiOutlineTrash />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={currentEntry ? "Edit Entry" : "Add Entry"}>
        <form onSubmit={handleSubmit} className="form-container">
          <div className="form-group">
            <label>Person Name</label>
            <input type="text" value={formData.person_name} onChange={(e) => setFormData({...formData, person_name: e.target.value})} required className="form-input" />
          </div>
          
          <div className="form-group">
            <label>Type</label>
            <select value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})} className="form-input">
              <option value="lent">I lent money</option>
              <option value="borrowed">I borrowed money</option>
            </select>
          </div>

          <div className="form-group">
            <label>Amount</label>
            <input type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} required className="form-input" />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Interest Type</label>
              <select value={formData.interest_type} onChange={(e) => setFormData({...formData, interest_type: e.target.value})} className="form-input">
                <option value="none">None</option>
                <option value="simple">Simple</option>
                <option value="compound">Compound</option>
              </select>
            </div>
            
            {formData.interest_type !== 'none' && (
              <div className="form-group">
                <label>Rate (%)</label>
                <input type="number" step="0.01" value={formData.interest_rate} onChange={(e) => setFormData({...formData, interest_rate: e.target.value})} className="form-input" />
              </div>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={formData.borrow_date} onChange={(e) => setFormData({...formData, borrow_date: e.target.value})} required className="form-input" />
            </div>
            <div className="form-group">
              <label>Due Date (Optional)</label>
              <input type="date" value={formData.due_date} onChange={(e) => setFormData({...formData, due_date: e.target.value})} className="form-input" />
            </div>
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} className="form-input" rows="2"></textarea>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">{currentEntry ? 'Save Changes' : 'Add Entry'}</button>
          </div>
        </form>
      </Modal>

      {/* Settle Modal */}
      <Modal isOpen={isSettleModalOpen} onClose={() => setIsSettleModalOpen(false)} title="Settle Payment">
        <form onSubmit={handleSettle} className="form-container">
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Enter the amount being settled for {currentEntry?.person_name}.
          </p>
          <div className="form-group">
            <label>Amount to Settle</label>
            <input type="number" step="0.01" value={settleAmount} onChange={(e) => setSettleAmount(e.target.value)} required max={currentEntry ? (parseFloat(currentEntry.amount) + parseFloat(currentEntry.interest_accrued || 0) - parseFloat(currentEntry.amount_settled || 0)) : ''} className="form-input" />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={() => setIsSettleModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-success">Confirm Payment</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog 
        isOpen={isConfirmOpen} 
        onClose={() => setIsConfirmOpen(false)} 
        onConfirm={handleDelete} 
        title="Delete Entry" 
        message="Are you sure you want to delete this record? This action cannot be undone."
      />
    </div>
  );
};

export default BorrowingPage;
