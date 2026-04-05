import { useState, useEffect } from 'react';
import { getAlerts, markAlertRead, generateSmartAlerts } from '../services/api';
import { FiAlertTriangle, FiAlertCircle, FiInfo, FiTrendingUp, FiCheck, FiRefreshCw } from 'react-icons/fi';

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchAlerts = async () => {
    try {
      const { data } = await getAlerts();
      setAlerts(data);
    } catch (err) {
      console.error('Failed to load alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      // Generate smart alerts first, then fetch all
      try { await generateSmartAlerts(); } catch {}
      fetchAlerts();
    };
    init();
  }, []);

  const handleMarkRead = async (id) => {
    try {
      await markAlertRead(id);
      setAlerts((prev) => prev.map((a) => a._id === id ? { ...a, read: true } : a));
    } catch (err) {
      console.error('Failed to mark alert:', err);
    }
  };

  const typeIcon = (type) => {
    switch (type) {
      case 'fraud': return <FiAlertTriangle className="text-red-600" size={18} />;
      case 'warning': return <FiAlertCircle className="text-yellow-600" size={18} />;
      case 'prediction': return <FiTrendingUp className="text-blue-600" size={18} />;
      default: return <FiInfo className="text-gray-600" size={18} />;
    }
  };

  const severityBadge = (severity) => {
    const colors = {
      high: 'bg-red-100 text-red-700',
      medium: 'bg-yellow-100 text-yellow-700',
      low: 'bg-blue-100 text-blue-700',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[severity] || colors.low}`}>
        {severity}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Alerts & Notifications</h2>
        <button
          onClick={async () => {
            setGenerating(true);
            try {
              await generateSmartAlerts();
              await fetchAlerts();
            } catch {}
            setGenerating(false);
          }}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50 cursor-pointer"
        >
          <FiRefreshCw size={14} className={generating ? 'animate-spin' : ''} />
          {generating ? 'Analyzing...' : 'Generate Smart Alerts'}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        {alerts.length === 0 ? (
          <p className="p-8 text-gray-500 text-center">No alerts. You're all good! ✅</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {alerts.map((alert) => (
              <div key={alert._id} className={`flex items-start gap-4 px-6 py-4 ${alert.read ? 'opacity-60' : ''}`}>
                <div className="mt-0.5">{typeIcon(alert.type)}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-gray-500 uppercase">{alert.type}</span>
                    {severityBadge(alert.severity)}
                  </div>
                  <p className="text-sm text-gray-800">{alert.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(alert.createdAt).toLocaleString()}</p>
                </div>
                {!alert.read && (
                  <button
                    onClick={() => handleMarkRead(alert._id)}
                    className="text-gray-400 hover:text-green-600 transition cursor-pointer"
                    title="Mark as read"
                  >
                    <FiCheck size={18} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
