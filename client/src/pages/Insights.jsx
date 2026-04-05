import { useState, useEffect } from 'react';
import { getInsights, predictBalance } from '../services/api';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { FiTrendingUp, FiAlertTriangle } from 'react-icons/fi';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6'];

export default function Insights() {
  const [insights, setInsights] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [insRes, predRes] = await Promise.all([getInsights(), predictBalance()]);
        setInsights(insRes.data);
        setPrediction(predRes.data);
      } catch (err) {
        console.error('Failed to load insights:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const chartData = insights?.spendingBreakdown
    ? Object.entries(insights.spendingBreakdown).map(([name, value]) => ({ name, value }))
    : [];

  const healthColor = (score) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">AI Insights</h2>

      {insights ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Health score */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Financial Health Score</h3>
            <div className="flex items-center gap-4">
              <div className={`text-5xl font-bold ${healthColor(insights.financialHealthScore)}`}>
                {insights.financialHealthScore}
              </div>
              <div>
                <p className="text-sm text-gray-500">out of 100</p>
                <p className="text-xs text-gray-400 mt-1">Savings Rate: {insights.savingsRate}%</p>
              </div>
            </div>
            <div className="mt-4 bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  insights.financialHealthScore >= 70 ? 'bg-green-500' :
                  insights.financialHealthScore >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${insights.financialHealthScore}%` }}
              />
            </div>
          </div>

          {/* Spending chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Spending Breakdown</h3>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `₹${value.toLocaleString('en-IN')}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 text-sm text-center py-8">No spending data available.</p>
            )}
          </div>

          {/* Summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Monthly Summary</h3>
            <p className="text-sm text-gray-700">{insights.monthlySummary}</p>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-red-50 rounded-lg p-3">
                <p className="text-xs text-red-600">Total Spent</p>
                <p className="font-bold text-red-700">₹{insights.totalSpent?.toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-xs text-green-600">Total Income</p>
                <p className="font-bold text-green-700">₹{insights.totalIncome?.toLocaleString('en-IN')}</p>
              </div>
            </div>
          </div>

          {/* Prediction */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-3">
              <FiTrendingUp className="text-indigo-600" />
              <h3 className="font-semibold text-gray-900">Predictive Analysis</h3>
            </div>
            {prediction ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-700">{prediction.warning}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-indigo-50 rounded-lg p-3">
                    <p className="text-xs text-indigo-600">Weekly Expense (est.)</p>
                    <p className="font-bold text-indigo-700">₹{prediction.predicted_weekly_expense?.toLocaleString('en-IN')}</p>
                  </div>
                  <div className="bg-indigo-50 rounded-lg p-3">
                    <p className="text-xs text-indigo-600">Days Until Low</p>
                    <p className="font-bold text-indigo-700">{prediction.days_until_low_balance}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Not enough data for predictions.</p>
            )}
          </div>

          {/* AI Prediction */}
          <div className="md:col-span-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
            <div className="flex items-center gap-2 mb-2">
              <FiAlertTriangle />
              <h3 className="font-semibold">AI Prediction</h3>
            </div>
            <p className="text-indigo-100">{insights.prediction}</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500">No insights available. Make some transactions to get AI-powered insights!</p>
        </div>
      )}
    </div>
  );
}
