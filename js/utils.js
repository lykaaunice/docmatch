// Small browser helpers shared by the UI.
(function () {
  const TIME_SLOTS = [
    { value: '09:00:00', label: '09:00 AM' },
    { value: '10:30:00', label: '10:30 AM' },
    { value: '13:30:00', label: '01:30 PM' },
    { value: '15:00:00', label: '03:00 PM' }
  ];

  const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const esc = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const fmtTime = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    return `${String(h % 12 || 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  };

  const statusLabel = (st) => (st || '').replace(/_/g, ' ');
  const statusClass = (st) => ({
    Pending: 'bg-amber-950 text-amber-400 border-amber-800',
    Booked: 'bg-emerald-950 text-emerald-400 border-emerald-800',
    Needs_Reassignment: 'bg-red-950 text-red-400 border-red-800',
    Proposed: 'bg-sky-950 text-sky-400 border-sky-800',
    Checked_In: 'bg-cyan-950 text-cyan-400 border-cyan-800',
    Completed: 'bg-purple-950 text-purple-300 border-purple-800',
    Cancelled: 'bg-zinc-800 text-zinc-500 border-zinc-700'
  }[st] || 'bg-zinc-800 text-zinc-400 border-zinc-700');
  const canModify = (app) => ['Pending', 'Booked', 'Needs_Reassignment'].includes(app.status);


  window.DocMatchUtils = { TIME_SLOTS, DAY_NAMES, esc, fmtTime, statusLabel, statusClass, canModify };
})();
