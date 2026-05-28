import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  HiOutlineTrendingUp, HiOutlineTrendingDown,
  HiOutlineCurrencyRupee, HiOutlineShieldCheck,
} from 'react-icons/hi';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { formatCurrency } from '../../utils/currency';
import { formatDate, getCategoryColor, getCategoryIcon, getDaysRemaining, getUrgencyColor } from '../../utils/helpers';
import './Dashboard.css';

const PIE_COLORS = [
  '#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ef4444',
  '#ec4899', '#8b5cf6', '#3b82f6', '#f97316', '#14b8a6',
];

function Dashboard() {
  const { user, currency } = useAuth();
  const [summary, setSummary] = useState({
    totalIncome: 0, totalExpenses: 0, totalSavings: 0,
  });
  const [monthlyData, setMonthlyData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [summaryRes, monthlyRes, categoryRes, remindersRes, expRes, incRes] = await Promise.allSettled([
        api.get('/dashboard/summary'),
        api.get('/dashboard/monthly-trend'),
        api.get('/expenses/summary'),
        api.get('/dashboard/reminders'),
        api.get('/expenses'),
        api.get('/income')
      ]);

      if (summaryRes.status === 'fulfilled') {
        const s = summaryRes.value.data.data;
        setSummary({
          totalIncome: s.total_income || 0,
          totalExpenses: s.total_expenses || 0,
          totalSavings: s.total_savings || 0,
          netBalance: s.net_balance || 0
        });
      }

      if (monthlyRes.status === 'fulfilled') {
        setMonthlyData(monthlyRes.value.data.data);
      }

      if (categoryRes.status === 'fulfilled') {
        const cats = categoryRes.value.data.data.categories || [];
        setCategoryData(cats.map(c => ({ name: c.category, value: Number(c.total_amount) })));
      }

      // Process real recent transactions instead of fallback
      let recentTxns = [];
      if (expRes.status === 'fulfilled') {
        const expenses = expRes.value.data.data.map(e => ({
          ...e,
          type: 'expense',
          date: e.expense_date
        }));
        recentTxns = [...recentTxns, ...expenses];
      }
      if (incRes.status === 'fulfilled') {
        const incomes = incRes.value.data.data.map(i => ({
          ...i,
          title: i.source_name,
          category: 'Salary', // default icon for income
          type: 'income',
          date: i.income_date
        }));
        recentTxns = [...recentTxns, ...incomes];
      }
      
      // Sort by date descending and take top 5
      recentTxns.sort((a, b) => new Date(b.date) - new Date(a.date));
      setRecentTransactions(recentTxns.slice(0, 5));

      if (remindersRes.status === 'fulfilled') {
        const upcoming = remindersRes.value.data.data.upcoming_borrowings || [];
        const mapped = upcoming.map((b) => ({
          ...b,
          personName: b.person_name,
          dueDate: b.due_date,
          daysRemaining: getDaysRemaining(b.due_date),
        }))
        .sort((a, b) => (a.daysRemaining || 999) - (b.daysRemaining || 999))
        .slice(0, 5);
        setReminders(mapped);
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const netBalance = summary.netBalance || 0;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-card-static" style={{ padding: '12px 16px', fontSize: '13px' }}>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}</p>
          {payload.map((p, i) => (
            <p key={i} style={{ color: p.color }}>
              {p.name}: {formatCurrency(p.value, currency)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div>
        <div className="dashboard-welcome">
          <div className="skeleton skeleton-title" style={{ width: '200px' }} />
          <div className="skeleton skeleton-text" style={{ width: '300px' }} />
        </div>
        <div className="dashboard-summary">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton skeleton-card" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Welcome */}
      <div className="dashboard-welcome">
        <h1>
          Welcome back, <span className="text-gradient">{user?.username || 'User'}</span> 👋
        </h1>
        <p>Here&apos;s an overview of your finances</p>
      </div>

      {/* Summary Cards */}
      <div className="dashboard-summary">
        <div className="glass-card summary-card">
          <div className="summary-card-header">
            <span className="summary-card-title">Total Income</span>
            <div className="summary-card-icon income">
              <HiOutlineTrendingUp />
            </div>
          </div>
          <p className="summary-card-amount">{formatCurrency(summary.totalIncome || 0, currency)}</p>
          <p className="summary-card-sub">All time earnings</p>
        </div>

        <div className="glass-card summary-card">
          <div className="summary-card-header">
            <span className="summary-card-title">Total Expenses</span>
            <div className="summary-card-icon expense">
              <HiOutlineTrendingDown />
            </div>
          </div>
          <p className="summary-card-amount">{formatCurrency(summary.totalExpenses || 0, currency)}</p>
          <p className="summary-card-sub">All time spending</p>
        </div>

        <div className="glass-card summary-card">
          <div className="summary-card-header">
            <span className="summary-card-title">Net Balance</span>
            <div className="summary-card-icon balance">
              <HiOutlineCurrencyRupee />
            </div>
          </div>
          <p className="summary-card-amount" style={{ color: netBalance >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {formatCurrency(netBalance, currency)}
          </p>
          <p className="summary-card-sub">Income − Expenses</p>
        </div>

        <div className="glass-card summary-card">
          <div className="summary-card-header">
            <span className="summary-card-title">Total Savings</span>
            <div className="summary-card-icon savings">
              <HiOutlineShieldCheck />
            </div>
          </div>
          <p className="summary-card-amount">{formatCurrency(summary.totalSavings || 0, currency)}</p>
          <p className="summary-card-sub">Across all goals</p>
        </div>
      </div>

      {/* Charts */}
      <div className="dashboard-charts">
        <div className="glass-card-static chart-card">
          <h3 className="chart-card-title">Income vs Expenses</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} />
              <YAxis stroke="var(--text-muted)" fontSize={12} />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="income"
                name="Income"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={{ fill: '#10b981', r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="expenses"
                name="Expenses"
                stroke="#ef4444"
                strokeWidth={2.5}
                dot={{ fill: '#ef4444', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card-static chart-card">
          <h3 className="chart-card-title">Expense Breakdown</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={95}
                paddingAngle={4}
                dataKey="value"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => formatCurrency(value, currency)}
                contentStyle={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-card)',
                  borderRadius: '8px',
                  fontSize: '13px',
                }}
                itemStyle={{ color: 'var(--text-primary)' }}
                labelStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom section */}
      <div className="dashboard-bottom">
        {/* Recent Transactions */}
        <div className="glass-card-static recent-card">
          <h3 className="recent-card-title">Recent Transactions</h3>
          {recentTransactions.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem 0' }}>
              <p className="empty-state-text">No recent transactions yet.</p>
            </div>
          ) : (
            recentTransactions.map((txn, index) => (
              <div className="recent-item" key={txn._id || index}>
                <div className="recent-item-icon">
                  {getCategoryIcon(txn.category)}
                </div>
                <div className="recent-item-info">
                  <p className="recent-item-title">{txn.title || txn.source}</p>
                  <p className="recent-item-date">{formatDate(txn.date)}</p>
                </div>
                <span className={`recent-item-amount ${txn.type === 'income' ? 'income' : 'expense'}`}>
                  {txn.type === 'income' ? '+' : '−'}
                  {formatCurrency(txn.amount, currency)}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Reminders */}
        <div className="glass-card-static recent-card">
          <h3 className="recent-card-title">Upcoming Reminders</h3>
          {reminders.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem 0' }}>
              <p className="empty-state-text">No upcoming due dates.</p>
            </div>
          ) : (
            reminders.map((r, index) => {
              const urgency = getUrgencyColor(r.daysRemaining);
              return (
                <div className={`reminder-item ${urgency}`} key={r._id || index}>
                  <div style={{ flex: 1 }}>
                    <p className="reminder-person">{r.personName}</p>
                    <p className="reminder-detail">
                      {formatCurrency(r.amount, currency)} · Due {formatDate(r.dueDate)}
                    </p>
                  </div>
                  <span className="reminder-days" style={{
                    color: urgency === 'safe' ? 'var(--color-success)' :
                           urgency === 'warning' ? 'var(--color-warning)' :
                           'var(--color-danger)'
                  }}>
                    {r.daysRemaining < 0
                      ? `${Math.abs(r.daysRemaining)}d overdue`
                      : r.daysRemaining === 0
                      ? 'Due today'
                      : `${r.daysRemaining}d left`}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
