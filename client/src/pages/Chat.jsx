import { useState, useRef, useEffect } from 'react';
import { aiChat, getChatHistory, aiTransfer } from '../services/api';
import { FiSend, FiUser, FiCpu, FiCheckCircle } from 'react-icons/fi';

export default function Chat() {
  const [messages, setMessages] = useState([
    { role: 'ai', text: "Hello! I'm your AI banking assistant. Ask me about your balance, spending, savings tips, or even transfer money!" },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [pendingTransfer, setPendingTransfer] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const { data } = await getChatHistory();
        if (data.length > 0) {
          const historyMsgs = data.map((m) => ({ role: m.role === 'user' ? 'user' : 'ai', text: m.message }));
          setMessages([
            { role: 'ai', text: "Hello! I'm your AI banking assistant. Here's our previous conversation:" },
            ...historyMsgs,
            { role: 'ai', text: "Welcome back! How can I help you today?" },
          ]);
        }
      } catch {
        // Silent fail — just use default welcome
      } finally {
        setHistoryLoaded(true);
      }
    };
    loadHistory();
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      // Check if user is confirming a pending transfer
      const isConfirm = /^(yes|confirm|haan|ha|proceed|go\s*ahead|do\s*it|ok|okay|sure|kar\s*do|bhej\s*do)$/i.test(userMsg);
      const isCancel = /^(no|cancel|nahi|abort|stop|ruk|nah)$/i.test(userMsg);

      if (pendingTransfer && isConfirm) {
        // Execute the transfer
        try {
          const { data } = await aiTransfer(pendingTransfer);
          const successMsg = `✅ **Transfer Successful!**\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `  🎫 UTR Number: **${data.utr}**\n` +
            `  👤 To: ${data.beneficiaryName}\n` +
            `  🏦 Bank: ${data.bankName}\n` +
            `  📝 Account: ${data.accountNumber}\n` +
            `  💰 Amount: ₹${data.amount.toLocaleString('en-IN')}\n` +
            `  📅 Mode: NEFT\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `  💰 New Balance: ₹${data.newBalance.toLocaleString('en-IN')}\n\n` +
            `📌 Save your UTR number for reference.\n` +
            `⏰ NEFT settlement: Usually within 2 hours.`;
          setMessages((prev) => [...prev, { role: 'ai', text: successMsg }]);
          setPendingTransfer(null);
        } catch (err) {
          setMessages((prev) => [...prev, { role: 'ai', text: `❌ Transfer failed: ${err.response?.data?.message || 'Something went wrong. Please try again.'}` }]);
          setPendingTransfer(null);
        }
      } else if (pendingTransfer && isCancel) {
        setMessages((prev) => [...prev, { role: 'ai', text: '❌ Transfer cancelled. Let me know if you need anything else!' }]);
        setPendingTransfer(null);
      } else {
        // Normal chat
        const { data } = await aiChat({ message: userMsg });
        const reply = data.reply;

        // Check if AI response contains a transfer summary (ready for confirmation)
        if (reply.includes('Transfer Summary') && reply.includes('confirm')) {
          // Parse transfer details from the conversation
          const transfer = parseTransferFromChat(userMsg, messages);
          if (transfer) {
            setPendingTransfer(transfer);
          }
        }

        setMessages((prev) => [...prev, { role: 'ai', text: reply }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'ai', text: "Sorry, I couldn't process your request right now. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const parseTransferFromChat = (currentMsg, allMessages) => {
    // Collect all text from recent conversation
    const allText = allMessages.slice(-10).map(m => m.text).join(' ') + ' ' + currentMsg;

    // Extract fields
    const accMatch = allText.match(/\b(\d{9,18})\b/);
    const ifscMatch = allText.toUpperCase().match(/\b([A-Z]{4}0[A-Z0-9]{6})\b/);
    const amtPatterns = [
      /(?:₹|rs\.?\s*|inr\s*)([\d,]+(?:\.\d{1,2})?)/i,
      /([\d,]+)\s*(?:₹|rs|rupees?)/i,
      /(?:amount|transfer|send|pay)\s*(?:of\s*)?(?:₹|rs\.?\s*)?([\d,]+)/i,
    ];
    let amount = null;
    for (const p of amtPatterns) {
      const m = allText.match(p);
      if (m) { amount = parseFloat(m[1].replace(/,/g, '')); if (amount >= 1) break; }
    }

    const namePatterns = [
      /(?:name|beneficiary|to|receiver)\s*(?:is|:|-|=)?\s*([A-Z][a-z]+(?: [A-Z][a-z]+)*)/,
      /(?:send\s+to|pay\s+to|transfer\s+to)\s+([A-Z][a-z]+(?: [A-Z][a-z]+)*)/,
    ];
    let name = null;
    for (const p of namePatterns) {
      const m = allText.match(p);
      if (m && m[1].length > 2) { name = m[1]; break; }
    }

    if (accMatch && ifscMatch && amount) {
      return {
        accountNumber: accMatch[1],
        ifsc: ifscMatch[1],
        amount,
        beneficiaryName: name || 'Beneficiary',
      };
    }
    return null;
  };

  const suggestions = [
    "What is my balance?",
    "Show my transactions",
    "How much did I spend?",
    "Give me saving tips",
    "What is my CIBIL score?",
    "Transfer money",
    "Check IFSC SBIN0001234",
    "What is NEFT?",
    "Where should I invest?",
    "How to save tax?",
    "Quiz me on finance",
    "I'm stressed about money",
    "I want to save for a car",
    "Show my subscriptions",
    "What if I cut spending 10%?",
    "Tell me about micro investment",
    "How to repay my debt?",
    "Coach my spending habits",
    "Generate a budget for me",
    "Set up auto savings",
    "Scan for anomalies",
    "Predict my cash flow",
    "Explain mutual funds",
    "Mera balance kya hai?",
    "Help",
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)]">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">AI Financial Assistant</h2>

      {/* Chat messages */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              msg.role === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-purple-100 text-purple-600'
            }`}>
              {msg.role === 'user' ? <FiUser size={16} /> : <FiCpu size={16} />}
            </div>
            <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm whitespace-pre-line ${
              msg.role === 'user'
                ? 'bg-indigo-600 text-white rounded-tr-none'
                : 'bg-gray-100 text-gray-800 rounded-tl-none'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
              <FiCpu size={16} />
            </div>
            <div className="bg-gray-100 rounded-2xl rounded-tl-none px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 2 && historyLoaded && (
        <div className="flex flex-wrap gap-2 mt-3">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => { setInput(s); }}
              className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium hover:bg-indigo-100 transition cursor-pointer"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="mt-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me anything about your finances..."
          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl hover:bg-indigo-700 transition disabled:opacity-50 cursor-pointer"
        >
          <FiSend size={18} />
        </button>
      </form>
    </div>
  );
}
