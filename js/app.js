const { createApp, ref, computed, onMounted } = Vue;

const App = {
  template: APP_TEMPLATE,
  setup() {
    const { TIME_SLOTS, DAY_NAMES, esc, fmtTime, statusLabel, statusClass, canModify } = window.DocMatchUtils;
    const swalDark = { background: '#121216', color: '#fff' };
    const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];

    const currentUser = ref(null);
    const activeRole = ref('');
    const navPage = ref('dashboard');
    const isLoading = ref(false);
    const compactMode = ref(typeof localStorage !== 'undefined' && localStorage.getItem('docmatch_compact') === '1');
    const lightMode = ref(typeof localStorage !== 'undefined' && localStorage.getItem('docmatch_light') === '1');
    const notifEnabled = ref(typeof localStorage === 'undefined' || localStorage.getItem('docmatch_notifs') !== '0');
    const calendarMode = ref('week');
    const calendarDate = ref(today);
    const activityLogs = ref([]);
    const messageConversations = ref([]);
    const messages = ref([]);
    const selectedConversationId = ref(null);
    const messageDraft = ref('');
    const unreadMessages = ref(0);

    const loginForm = ref({ username: '', password: '' });
    const authMode = ref('login');   // 'login' | 'register'
    const showAuth = ref(false);
    const profileForm = ref({ full_name: '', contact_number: '' });
    const registerForm = ref({ full_name: '', contact_number: '', username: '', password: '', confirm: '' });
    const specialties = ref([]);
    const doctors = ref([]);
    const appointments = ref([]);
    const notifications = ref([]);
    const leaves = ref([]);
    const schedule = ref([]);
    const showSchedule = ref(false);
    const unreadNotifs = ref(0);
    const showNotifs = ref(false);

    const selectedSpecialtyId = ref(null);
    const bookingForms = ref({});   // { [doctorId]: { date, time } }
    const slotInfo = ref({});       // { [doctorId]: { taken: [], blocked: bool } }

    const search = ref('');
    const statusFilter = ref('');
    let refreshTimer = null;
    let messageTimer = null;

    // General helpers
    const doctorYears = (doc) => ({'Pediatrics':8,'Dermatology':7,'General Medicine':10,'Cardiology':12}[doc.specialty_name] || 6);
    const doctorFocus = (doc) => ({'Pediatrics':'Child wellness, routine consultations, and pediatric follow-up care.','Dermatology':'Skin consultations, common dermatologic concerns, and follow-up care.','General Medicine':'Primary care, general consultations, preventive care, and referrals.','Cardiology':'Heart health consultations, cardiovascular assessment, and continuing care.'}[doc.specialty_name] || 'Patient consultations, assessment, and continuity of care.');

    const toast = (title, icon = 'success') => {
      Swal.fire({ toast: true, position: 'top-end', icon, title, showConfirmButton: false, timer: 3500, ...swalDark });
    };

    const { api, refreshCsrf } = createApiClient({
      toast,
      isLoggedIn: () => !!currentUser.value,
      onSessionExpired: (data) => {
        currentUser.value = null;
        activeRole.value = '';
        stopRefresh();
        toast(data.message || 'Session expired. Please log in again.', 'warning');
      }
    });

    const busy = async (fn) => {
      isLoading.value = true;
      try { return await fn(); } finally { isLoading.value = false; }
    };

    // Session and authentication
    const startRefresh = () => {
      stopRefresh();
      refreshTimer = setInterval(() => {
        if (currentUser.value && !Swal.isVisible()) { loadAppointments(); loadNotifications(); loadLeaves(); loadSchedule(); }
      }, 30000);
      if (['patient','doctor'].includes(activeRole.value)) {
        messageTimer = setInterval(() => { if (currentUser.value && !Swal.isVisible()) { loadMessages(selectedConversationId.value, true); loadNotifications(); } }, 4000);
      }
    };
    const stopRefresh = () => { if (refreshTimer) clearInterval(refreshTimer); if (messageTimer) clearInterval(messageTimer); refreshTimer = null; messageTimer = null; };

    const checkSession = async () => {
      await busy(async () => {
        const data = await api('backend/api/check_session.php', null, { silent: true });
        if (data && data.authenticated) {
          currentUser.value = data.user;
          activeRole.value = data.user.role;
          navPage.value = 'dashboard';
          await loadData();
          startRefresh();
        } else {
          currentUser.value = null;
          await loadPublicOverview();
        }
      });
    };

    const handleLogin = async () => {
      await busy(async () => {
        const data = await api('backend/api/login.php', { username: loginForm.value.username.trim(), password: loginForm.value.password });
        if (data && data.success) {
          loginForm.value = { username: '', password: '' };
          toast('Welcome back!');
          currentUser.value = data.user;
          activeRole.value = data.user.role;
          navPage.value = 'dashboard';
          await loadData();
          startRefresh();
        }
      });
    };

    const handleRegister = async () => {
      const f = registerForm.value;
      if (f.password !== f.confirm) { toast('Passwords do not match.', 'error'); return; }
      await busy(async () => {
        const data = await api('backend/api/register.php', {
          full_name: f.full_name.trim(), contact_number: f.contact_number.trim(),
          username: f.username.trim(), password: f.password
        });
        if (data && data.success) {
          loginForm.value = { username: data.username || f.username.trim(), password: '' };
          registerForm.value = { full_name: '', contact_number: '', username: '', password: '', confirm: '' };
          authMode.value = 'login';
          toast('Account created. Please log in.');
        }
      });
    };

    const handleLogout = async () => {
      const confirm = await Swal.fire({
        title: 'Log out of DocMatch?',
        text: 'Are you sure you want to end your current session?',
        icon: 'question', showCancelButton: true, confirmButtonText: 'Yes, log out',
        cancelButtonText: 'Stay logged in', confirmButtonColor: '#dc2626', ...swalDark
      });
      if (!confirm.isConfirmed) return;
      await busy(async () => {
        await api('backend/api/logout.php', {}, { silent: true });
        await refreshCsrf();
        stopRefresh();
        currentUser.value = null;
        activeRole.value = '';
        navPage.value = 'dashboard';
        appointments.value = [];
        notifications.value = [];
        unreadNotifs.value = 0;
        showNotifs.value = false;
        selectedSpecialtyId.value = null;
        messageConversations.value=[]; messages.value=[]; selectedConversationId.value=null; unreadMessages.value=0;
      });
      toast('Logged out.');
      showAuth.value = false;
    };

    const loadPublicOverview = async () => {
      const ov = await api('backend/api/get_overview.php', null, { silent: true });
      if (ov && ov.success) { specialties.value = ov.specialties || []; doctors.value = ov.doctors || []; }
    };

    const openProfile = async () => {
      const data = await api('backend/api/profile.php', null, { silent: true });
      if (!data || !data.success) return;
      const u = data.user;
      const { value } = await Swal.fire({
        title: 'My Profile',
        html: `<div style="text-align:left"><label class="swal-label">Full name</label><input id="pf-name" class="swal2-input" value="${esc(u.full_name || '')}"><label class="swal-label">Contact number</label><input id="pf-contact" class="swal2-input" value="${esc(u.contact_number || '')}"><div class="profile-meta">Username: <b>${esc(u.username || '')}</b><br>Role: <b>${esc(u.role || '')}</b></div></div>`,
        showCancelButton: true, confirmButtonText: 'Save changes', ...swalDark,
        preConfirm: () => ({ full_name: document.getElementById('pf-name').value.trim(), contact_number: document.getElementById('pf-contact').value.trim() })
      });
      if (!value) return;
      const r = await api('backend/api/profile.php', value);
      if (r && r.success) { currentUser.value.full_name = r.user.full_name; toast('Profile updated.'); }
    };

    const openSettings = async () => {
      const { value } = await Swal.fire({
        title: 'Account Settings',
        html: `<div style="text-align:left"><p class="settings-help">Change your password below. Use at least 8 characters.</p><label class="swal-label">Current password</label><input id="st-old" type="password" class="swal2-input"><label class="swal-label">New password</label><input id="st-new" type="password" class="swal2-input"><label class="swal-label">Confirm new password</label><input id="st-confirm" type="password" class="swal2-input"></div>`,
        showCancelButton: true, confirmButtonText: 'Update password', ...swalDark,
        preConfirm: () => { const a=document.getElementById('st-old').value,b=document.getElementById('st-new').value,c=document.getElementById('st-confirm').value; if(!a||b.length<8){Swal.showValidationMessage('Complete the fields and use at least 8 characters.');return false;} if(b!==c){Swal.showValidationMessage('New passwords do not match.');return false;} return {current_password:a,new_password:b}; }
      });
      if (!value) return;
      const r = await api('backend/api/change_password.php', value);
      if (r && r.success) toast('Password updated.');
    };

    // Data loading
    const loadAppointments = async () => {
      const data = await api('backend/api/get_admin_appointments.php', null, { silent: true });
      if (data && data.success) appointments.value = data.appointments || [];
    };

    const loadSchedule = async () => {
      if (activeRole.value !== 'coordinator') { schedule.value = []; return; }
      const data = await api('backend/api/get_schedule.php', null, { silent: true });
      if (data && data.success) schedule.value = data.doctors || [];
    };

    const loadLeaves = async () => {
      if (!['coordinator', 'doctor'].includes(activeRole.value)) { leaves.value = []; return; }
      const data = await api('backend/api/get_leaves.php', null, { silent: true });
      if (data && data.success) leaves.value = data.leaves || [];
    };

    const loadNotifications = async (markRead = false) => {
      const data = await api(`backend/api/get_notifications.php${markRead ? '?mark_read=1' : ''}`, null, { silent: true });
      if (data && data.success) {
        notifications.value = data.notifications || [];
        unreadNotifs.value = data.unread_count || 0;
      }
    };

    const loadActivity = async () => {
      if (activeRole.value !== 'coordinator') { activityLogs.value=[]; return; }
      const data = await api('backend/api/get_activity.php', null, { silent:true });
      if (data && data.success) activityLogs.value=data.logs||[];
    };

    const loadMessages = async (appointmentId = null, silent = false) => {
      if (!['patient','doctor'].includes(activeRole.value)) return;
      const id = appointmentId || selectedConversationId.value;
      const data = await api('backend/api/messages.php' + (id ? `?appointment_id=${encodeURIComponent(id)}` : ''), null, { silent });
      if (data && data.success) {
        messageConversations.value = data.conversations || [];
        unreadMessages.value = Number(data.unread_total || 0);
        if (id) { selectedConversationId.value = Number(id); messages.value = data.messages || []; }
      }
    };
    const openConversation = async (c) => { selectedConversationId.value=Number(c.appointment_id); await loadMessages(c.appointment_id); };
    const selectedConversationTitle = computed(() => { const c=messageConversations.value.find(x=>Number(x.appointment_id)===Number(selectedConversationId.value)); return c ? (activeRole.value==='patient' ? c.doctor_name : c.patient_name) : ''; });
    const sendMessage = async () => {
      const text=(messageDraft.value||'').trim(); if(!text||!selectedConversationId.value) return;
      const data=await api('backend/api/messages.php',{appointment_id:selectedConversationId.value,message:text});
      if(data&&data.success){ messageDraft.value=''; await loadMessages(selectedConversationId.value,true); }
    };

    const loadData = async () => {
      const ov = await api('backend/api/get_overview.php');
      if (ov && ov.success) {
        const docs = ov.doctors || [];
        const forms = {};
        docs.forEach(d => { forms[d.id] = bookingForms.value[d.id] || { date: '', time: '', reason_for_visit: '' }; });
        bookingForms.value = forms;
        specialties.value = ov.specialties || [];
        doctors.value = docs;
      }
      await loadAppointments();
      await loadNotifications();
      await loadLeaves();
      await loadSchedule();
      await loadActivity();
      if (['patient','doctor'].includes(activeRole.value)) await loadMessages(null, true);
    };

    const toggleNotifDropdown = async () => {
      showNotifs.value = !showNotifs.value;
      if (showNotifs.value && unreadNotifs.value > 0) await loadNotifications(true);
    };

    // Derived UI data
    const filteredDoctors = computed(() => {
      if (!selectedSpecialtyId.value) return [];
      return doctors.value.filter(d => d.specialty_id == selectedSpecialtyId.value);
    });

    // Show pending reviews before upcoming confirmed appointments.
    const doctorApps = computed(() => {
      const weekAgo = new Date(Date.now() - 7 * 864e5 - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
      // Keep recent completed visits visible until follow-up advice is added.
      const rows = appointments.value.filter(a => a.status === 'Pending' || a.status === 'Checked_In' ||
        (a.status === 'Booked' && (a.appointment_date >= today || (a.appointment_date >= weekAgo && !a.followup_timeframe))) ||
        (a.status === 'Completed' && a.appointment_date >= weekAgo));
      const rank = a => a.status === 'Pending' ? 0 : a.status === 'Checked_In' ? 1 : 2;
      return rows.sort((a, b) => rank(a) - rank(b)
        || (a.appointment_date + a.appointment_time).localeCompare(b.appointment_date + b.appointment_time));
    });

    const followupAppointments = computed(() => appointments.value.filter(a => {
      if (activeRole.value === 'doctor') return a.status === 'Completed';
      return !!a.followup_timeframe || a.status === 'Proposed';
    }).sort((a,b) => (b.appointment_date+b.appointment_time).localeCompare(a.appointment_date+a.appointment_time)));

    const filteredAppointments = computed(() => {
      const q = search.value.trim().toLowerCase();
      return appointments.value.filter(a => {
        if (statusFilter.value && a.status !== statusFilter.value) return false;
        if (!q) return true;
        return [a.reference_code, a.patient_name, a.doctor_name, a.specialty_name, a.contact_number]
          .some(v => (v || '').toLowerCase().includes(q));
      });
    });

    const workdayLabel = (arr) => (arr || []).map(n => DAY_NAMES[n - 1]).join(', ') || '—';
    const hasCoordAction = (app) =>
      (app.status === 'Pending' && !Number(app.forwarded_to_doctor)) ||
      app.status === 'Needs_Reassignment' ||
      ((app.status === 'Booked' || app.status === 'Proposed') && app.patient_id && !Number(app.patient_notified)) ||
      (app.status === 'Completed' && app.followup_timeframe && !Number(app.followup_relayed));

    const myDoctor = computed(() =>
      doctors.value.find(d => currentUser.value && d.id == currentUser.value.doctor_id) || null);

    const pendingLeaves = computed(() => leaves.value.filter(l => l.status === 'Pending'));

    const stageText = (app) => Number(app.forwarded_to_doctor)
      ? 'With the doctor — awaiting decision'
      : 'Waiting for the Coordinator to forward to the doctor';

    const statusCounts = computed(() => {
      const c = st => appointments.value.filter(a => a.status === st).length;
      return [
        { label: 'Pending', count: c('Pending'), color: 'text-amber-400' },
        { label: 'Booked', count: c('Booked'), color: 'text-emerald-400' },
        { label: 'Needs Reassignment', count: c('Needs_Reassignment'), color: 'text-red-400' },
        { label: 'Cancelled', count: c('Cancelled'), color: 'text-zinc-400' }
      ];
    });

    const activeAppointments = computed(() => appointments.value.filter(a => !['Completed','Cancelled','Declined'].includes(a.status)));
    const historyAppointments = computed(() => appointments.value.filter(a => ['Completed','Cancelled','Declined'].includes(a.status) || a.appointment_date < today).slice().sort((a,b)=>(b.appointment_date+b.appointment_time).localeCompare(a.appointment_date+a.appointment_time)));
    const todayQueue = computed(() => appointments.value.filter(a => a.appointment_date === today && ['Booked','Checked_In','Completed'].includes(a.status)).slice().sort((a,b)=>a.appointment_time.localeCompare(b.appointment_time)));
    const completionRate = computed(() => appointments.value.length ? Math.round(appointments.value.filter(a=>a.status==='Completed').length / appointments.value.length * 100) : 0);
    const specialtyReport = computed(() => {
      const total = Math.max(1, appointments.value.length);
      return specialties.value.map(s => { const count=appointments.value.filter(a=>a.specialty_id==s.id).length; return {name:s.name,count,percent:Math.round(count/total*100)}; }).sort((a,b)=>b.count-a.count);
    });
    const calendarItems = computed(() => {
      const base=new Date(calendarDate.value+'T00:00:00');
      let start=new Date(base), end=new Date(base);
      if(calendarMode.value==='week'){ const n=(base.getDay()+6)%7; start.setDate(base.getDate()-n); end=new Date(start); end.setDate(start.getDate()+6); }
      if(calendarMode.value==='month'){ start=new Date(base.getFullYear(),base.getMonth(),1); end=new Date(base.getFullYear(),base.getMonth()+1,0); }
      const iso=d=>new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
      return appointments.value.filter(a=>a.appointment_date>=iso(start)&&a.appointment_date<=iso(end)).slice().sort((a,b)=>(a.appointment_date+a.appointment_time).localeCompare(b.appointment_date+b.appointment_time));
    });
    const calendarTitle = computed(()=> calendarMode.value==='day' ? calendarDate.value : calendarMode.value==='week' ? 'Week of '+calendarDate.value : new Date(calendarDate.value+'T00:00:00').toLocaleDateString(undefined,{month:'long',year:'numeric'}));
    const moveCalendar = n => { const d=new Date(calendarDate.value+'T00:00:00'); d.setDate(d.getDate()+n*(calendarMode.value==='day'?1:calendarMode.value==='week'?7:30)); calendarDate.value=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10); };
    const toggleLightMode=()=>{ lightMode.value=!lightMode.value; localStorage.setItem('docmatch_light',lightMode.value?'1':'0'); document.documentElement.classList.toggle('dm-light',lightMode.value); };
    const toggleNotifPref=()=>{ notifEnabled.value=!notifEnabled.value; localStorage.setItem('docmatch_notifs',notifEnabled.value?'1':'0'); toast(notifEnabled.value?'Notification indicators enabled.':'Notification indicators muted.'); };
    const toggleCompactMode = () => { compactMode.value=!compactMode.value; if(typeof localStorage!=='undefined') localStorage.setItem('docmatch_compact', compactMode.value?'1':'0'); if(typeof document!=='undefined') document.documentElement.classList.toggle('dm-compact',compactMode.value); toast(compactMode.value?'Compact view enabled.':'Comfortable view enabled.'); };
    const bookWithDoctor = (doc) => { selectedSpecialtyId.value=doc.specialty_id; navPage.value='booking'; setTimeout(()=>document.getElementById('booking')?.scrollIntoView({behavior:'smooth'}),50); };
    const showAppointmentDetails = async (app) => {
      const stages = [
        ['Submitted', true], ['Coordinator', Number(app.forwarded_to_doctor)||app.status!=='Pending'],
        ['Doctor', Number(app.doctor_accepted)||['Booked','Checked_In','Completed'].includes(app.status)],
        ['Confirmed', Number(app.patient_notified)&&['Booked','Checked_In','Completed'].includes(app.status)],
        ['Check-in', ['Checked_In','Completed'].includes(app.status)], ['Completed', app.status==='Completed']
      ];
      const timeline=stages.map(([n,d])=>`<div class="modal-stage ${d?'done':''}"><i></i><span>${n}</span></div>`).join('');
      await Swal.fire({title:'Appointment Details',html:`<div class="appointment-modal"><div><span>Reference</span><b>${esc(app.reference_code||'')}</b></div><div><span>Patient</span><b>${esc(app.patient_name||'')}</b></div><div><span>Doctor</span><b>${esc(app.doctor_name||'')}</b></div><div><span>Specialty</span><b>${esc(app.specialty_name||'')}</b></div><div><span>Schedule</span><b>${esc(app.appointment_date||'')} · ${esc(fmtTime(app.appointment_time)||'')}</b></div><div><span>Status</span><b>${esc(statusLabel(app.status))}</b></div>${app.reason_for_visit?`<div><span>Reason for visit</span><b>${esc(app.reason_for_visit)}</b></div>`:''}</div><div class="modal-timeline">${timeline}</div>${app.followup_timeframe?`<div class="modal-note"><b>Follow-up:</b> ${esc(app.followup_timeframe)}<br>${esc(app.followup_notes||'')}</div>`:''}${app.decline_reason?`<div class="modal-note danger"><b>Reason:</b> ${esc(app.decline_reason)}</div>`:''}`,confirmButtonText:'Close',...swalDark});
    };

    const printAppointment = (app) => {
      const w = window.open('', '_blank', 'width=760,height=760');
      if (!w) { toast('Allow pop-ups to print the appointment slip.', 'warning'); return; }
      const html = `<!doctype html><html><head><title>DocMatch Appointment ${esc(app.reference_code||'')}</title><style>body{font-family:Arial,sans-serif;padding:36px;color:#111} .head{border-bottom:3px solid #2563eb;padding-bottom:14px;margin-bottom:24px} h1{margin:0;color:#2563eb} .row{display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding:10px 0}.label{color:#666}.note{margin-top:24px;padding:14px;background:#f3f4f6;border-radius:8px} @media print{button{display:none}}</style></head><body><div class="head"><h1>DocMatch</h1><div>Appointment Confirmation Slip</div></div><div class="row"><span class="label">Reference</span><b>${esc(app.reference_code||'')}</b></div><div class="row"><span class="label">Patient</span><b>${esc(app.patient_name||currentUser.value?.full_name||'')}</b></div><div class="row"><span class="label">Doctor</span><b>${esc(app.doctor_name||'')}</b></div><div class="row"><span class="label">Specialty</span><b>${esc(app.specialty_name||'')}</b></div><div class="row"><span class="label">Date & time</span><b>${esc(app.appointment_date||'')} ${esc(fmtTime(app.appointment_time)||'')}</b></div><div class="row"><span class="label">Status</span><b>${esc(statusLabel(app.status))}</b></div>${app.reason_for_visit?`<div class="row"><span class="label">Reason for visit</span><b>${esc(app.reason_for_visit)}</b></div>`:''}<div class="note">Please arrive a few minutes before your scheduled time and present this reference code at the clinic.</div><br><button onclick="window.print()">Print</button></body></html>`;
      w.document.write(html); w.document.close(); w.focus();
    };

    // Patient booking
    const isTaken = (docId, t) => !!(slotInfo.value[docId] && slotInfo.value[docId].taken.includes(t));

    const canSubmit = (doc) => {
      const f = bookingForms.value[doc.id];
      if (!f || !f.date || !f.time) return false;
      const info = slotInfo.value[doc.id];
      return !(info && info.blocked) && !isTaken(doc.id, f.time);
    };

    const onDateChange = async (doc) => {
      const f = bookingForms.value[doc.id];
      f.time = '';
      if (!f.date) return;
      const data = await api(`backend/api/get_booked_slots.php?doctor_id=${doc.id}&date=${f.date}`, null, { silent: true });
      if (data && data.success) slotInfo.value[doc.id] = { taken: data.taken || [], blocked: !!data.blocked };
    };

    const submitReservation = async (doc) => {
      const f = bookingForms.value[doc.id];
      if (!f || !f.date || !f.time) { toast('Select a date and time first', 'warning'); return; }
      if (f.date < today) { toast('Past dates are not allowed', 'warning'); return; }

      await busy(async () => {
        const data = await api('backend/api/book.php', {
          specialty_id: selectedSpecialtyId.value,
          doctor_id: doc.id,
          appointment_date: f.date,
          appointment_time: f.time,
          reason_for_visit: (f.reason_for_visit || '').trim()
        });
        if (data && data.success) {
          Swal.fire({
            icon: 'success',
            title: 'Reservation Submitted!',
            html: `Ref Code: <b>${esc(data.reference_code)}</b><br>Status: Pending confirmation.`,
            ...swalDark
          });
          bookingForms.value[doc.id] = { date: '', time: '', reason_for_visit: '' };
          delete slotInfo.value[doc.id];
          await loadData();
        } else if (data && data.message && /already taken/i.test(data.message)) {
          onDateChange(doc);  // refresh the taken times
        }
      });
    };

    const cancelAppointment = async (id) => {
      const r = await Swal.fire({
        title: 'Cancel this appointment?',
        input: 'text',
        inputLabel: 'Cancellation Reason (Optional)',
        showCancelButton: true,
        confirmButtonText: 'Yes, cancel',
        cancelButtonText: 'Cancel',
        ...swalDark
      });
      if (!r.isConfirmed) return;   // previously continued even after pressing Cancel

      await busy(async () => {
        const data = await api('backend/api/patient_actions.php', { action: 'cancel', appointment_id: id, reason: r.value });
        if (data.success) { toast('Appointment cancelled.'); await loadData(); }
      });
    };

    const timeOptions = (selected = '') => TIME_SLOTS.map(t =>
      `<option value="${t.value}" ${t.value === selected ? 'selected' : ''}>${t.label}</option>`).join('');

    const rescheduleAppointment = async (app) => {
      const { value: v } = await Swal.fire({
        title: 'Reschedule Appointment',
        html: `<input id="swal-rdate" type="date" min="${today}" value="${esc(app.appointment_date)}" class="swal2-input">
               <select id="swal-rtime" class="swal2-input">${timeOptions(app.appointment_time)}</select>`,
        focusConfirm: false,
        showCancelButton: true,
        ...swalDark,
        preConfirm: () => {
          const d = document.getElementById('swal-rdate').value;
          if (!d || d < today) { Swal.showValidationMessage('Select a valid date'); return false; }
          return [d, document.getElementById('swal-rtime').value];
        }
      });
      if (!v) return;

      await busy(async () => {
        const data = await api('backend/api/patient_actions.php', { action: 'reschedule', appointment_id: app.id, new_date: v[0], new_time: v[1] });
        if (data.success) { toast('Rescheduled. The doctor and Coordinator have been notified.'); await loadData(); }
      });
    };

    // Doctor actions
    const doctorDecision = async (id, action) => {
      let reason = null;
      if (action === 'decline') {
        const r = await Swal.fire({
          input: 'textarea',
          inputLabel: 'Decline Reason (optional)',
          inputPlaceholder: 'Write the reason here...',
          showCancelButton: true,
          ...swalDark
        });
        if (!r.isConfirmed) return;
        reason = r.value;
      }
      await busy(async () => {
        const data = await api('backend/api/doctor_action.php', { appointment_id: id, action, reason });
        if (data.success) {
          toast(action === 'accept' ? 'Appointment accepted!' : 'Appointment declined.');
          await loadData();
        }
      });
    };

    const setFollowupAdvice = async (id) => {
      const { value: v } = await Swal.fire({
        title: 'Follow-Up Advice',
        html: '<input id="swal-input1" class="swal2-input" placeholder="Timeframe (e.g. Within 1 month)">' +
              '<textarea id="swal-input2" class="swal2-textarea" placeholder="Notes / Instructions for the Patient"></textarea>',
        focusConfirm: false,
        showCancelButton: true,
        ...swalDark,
        preConfirm: () => {
          const t = document.getElementById('swal-input1').value.trim();
          if (!t) { Swal.showValidationMessage('Enter the timeframe'); return false; }
          return [t, document.getElementById('swal-input2').value.trim()];
        }
      });
      if (!v) return;

      await busy(async () => {
        const data = await api('backend/api/doctor_action.php', { action: 'followup', appointment_id: id, followup_period: v[0], followup_notes: v[1] });
        if (data.success) { toast('Follow-up advice sent to the patient and Coordinator.'); await loadData(); }
      });
    };

    const fileLeave = async () => {
      const r = await Swal.fire({
        title: 'Leave / Emergency Blockout',
        html: `<select id="swal-ltype" class="swal2-input">
                 <option value="Emergency">🚨 Emergency (blocked immediately)</option>
                 <option value="Planned">🗓️ Planned: seminar/vacation (needs approval)</option>
               </select>
               <div style="font-size:11px;text-align:left;margin:8px 20px 0;opacity:.7">Start</div>
               <input id="swal-lstart" type="date" min="${today}" value="${today}" class="swal2-input" style="margin-top:2px">
               <div style="font-size:11px;text-align:left;margin:8px 20px 0;opacity:.7">Until (leave blank for a single day)</div>
               <input id="swal-lend" type="date" min="${today}" class="swal2-input" style="margin-top:2px">
               <input id="swal-lreason" class="swal2-input" placeholder="Reason (optional)">`,
        focusConfirm: false,
        showCancelButton: true,
        ...swalDark,
        preConfirm: () => {
          const start = document.getElementById('swal-lstart').value;
          const end = document.getElementById('swal-lend').value || start;
          if (!start || start < today) { Swal.showValidationMessage('Select a valid start date'); return false; }
          if (end < start) { Swal.showValidationMessage('The end date cannot be earlier than the start date'); return false; }
          return {
            leave_type: document.getElementById('swal-ltype').value,
            start_date: start,
            end_date: end,
            reason: document.getElementById('swal-lreason').value.trim()
          };
        }
      });
      if (!r.isConfirmed || !r.value) return;

      await busy(async () => {
        // The server session determines the doctor account.
        const data = await api('backend/api/doctor_leave.php', r.value);
        if (!data.success) return;
        if (data.type === 'Emergency') {
          Swal.fire({
            icon: 'warning',
            title: 'Emergency Blockout Recorded!',
            text: `${data.affected_appointments || 0} appointment(s) sent to the Care Coordinator for reassignment.`,
            ...swalDark
          });
        } else {
          toast('Leave request sent to the Coordinator.');
        }
        await loadData();
      });
    };

    // Coordinator actions
    const forwardToDoctor = async (app) => {
      const r = await Swal.fire({
        title: 'Forward to the doctor?',
        text: `${app.patient_name} → ${app.doctor_name}`,
        input: 'textarea',
        inputLabel: 'Note for the doctor (optional)',
        inputPlaceholder: 'e.g. has asthma, first visit, etc.',
        showCancelButton: true,
        confirmButtonText: 'Yes, forward',
        cancelButtonText: 'Cancel',
        ...swalDark
      });
      if (!r.isConfirmed) return;
      await busy(async () => {
        const data = await api('backend/api/coordinator_actions.php', { action: 'forward', appointment_id: app.id, note: r.value || '' });
        if (data.success) {
          const lg = (data.doctor_logins || []).join(', ');
          toast(`Forwarded to ${app.doctor_name}` + (lg ? ` (login: ${lg})` : ''));
          await loadData();
        }
      });
    };

    const checkInPatient = async (app) => {
      if (app.appointment_date !== today) {
        const r = await Swal.fire({ title: 'This is not the appointment date', text: `It is scheduled for ${app.appointment_date}. Check in anyway?`,
          showCancelButton: true, confirmButtonText: 'Yes, check in', cancelButtonText: 'Cancel', ...swalDark });
        if (!r.isConfirmed) return;
      }
      await busy(async () => {
        const data = await api('backend/api/coordinator_actions.php', { action: 'checkin', appointment_id: app.id });
        if (data.success) { toast('Checked in. The doctor has been notified.'); await loadData(); }
      });
    };

    const doctorComplete = async (app) => {
      const r = await Swal.fire({ title: 'Consultation finished?', text: `${app.patient_name} (${app.reference_code})`,
        showCancelButton: true, confirmButtonText: 'Yes, done', cancelButtonText: 'Cancel', ...swalDark });
      if (!r.isConfirmed) return;
      await busy(async () => {
        const data = await api('backend/api/doctor_action.php', { appointment_id: app.id, action: 'complete' });
        if (data.success) {
          await loadData();
          const f = await Swal.fire({title:'Consultation completed',text:'Would you like to add follow-up advice for this patient now?',icon:'success',showCancelButton:true,confirmButtonText:'Add Follow-up Advice',cancelButtonText:'Not now',...swalDark});
          if (f.isConfirmed) await setFollowupAdvice(app.id);
          else { navPage.value='followups'; toast('Saved. You can add follow-up advice later from Follow-up Advice.'); }
        }
      });
    };

    const respondFollowup = async (app, accept) => {
      const r = await Swal.fire({
        title: accept ? 'Confirm the follow-up?' : 'Decline the follow-up?',
        text: `${app.doctor_name} - ${app.appointment_date} @ ${fmtTime(app.appointment_time)}`,
        showCancelButton: true, confirmButtonText: accept ? 'Confirm' : 'Decline', cancelButtonText: 'Back', ...swalDark
      });
      if (!r.isConfirmed) return;
      await busy(async () => {
        const data = await api('backend/api/patient_actions.php', { action: accept ? 'confirm_followup' : 'decline_followup', appointment_id: app.id });
        if (data.success) { toast(accept ? 'Your follow-up is confirmed.' : 'The coordinator has been informed.'); await loadData(); }
      });
    };

    const sendToPatient = async (app) => {
      const r = await Swal.fire({
        title: app.status === 'Proposed' ? 'Send Follow-up Schedule to Patient?' : 'Send Appointment Confirmation to Patient?',
        text: app.status === 'Proposed'
          ? `The proposed follow-up (${app.appointment_date}) will be sent to ${app.patient_name} for confirmation.`
          : `This will notify ${app.patient_name} that ${app.reference_code} is Booked.`,
        showCancelButton: true,
        confirmButtonText: 'Send to Patient',
        cancelButtonText: 'Cancel',
        ...swalDark
      });
      if (!r.isConfirmed) return;
      await busy(async () => {
        const data = await api('backend/api/coordinator_actions.php', { action: 'notify_patient', appointment_id: app.id });
        if (data.success) { toast(app.status === 'Proposed' ? 'Follow-up schedule sent to the patient.' : 'Appointment confirmation sent to the patient.'); await loadData(); }
      });
    };

    const scheduleFollowup = async (app) => {
      const sameSpec = doctors.value.filter(d => d.specialty_id == app.specialty_id);
      const options = sameSpec.length ? sameSpec : doctors.value;
      let docId = app.doctor_id;
      let weekOf = today;
      const lbl = 'font-size:11px;text-align:left;margin:8px 20px 0;opacity:.7';
      while (true) {
        const r = await Swal.fire({
          title: 'Schedule Follow-up',
          html: `<div style="font-size:12px;text-align:left;margin:0 20px;opacity:.85">Doctor advice: <b>${esc(app.followup_timeframe)}</b><br>${esc(app.followup_notes || '')}</div>
                 <div style="${lbl}">Doctor (same specialty)</div>
                 <select id="swal-fdoc" class="swal2-input" style="margin-top:2px">${options.map(d => `<option value="${d.id}" ${d.id == docId ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select>
                 <div style="${lbl}">Target week (any day in that week)</div>
                 <input id="swal-fweek" type="date" min="${today}" value="${esc(weekOf)}" class="swal2-input" style="margin-top:2px">`,
          showCancelButton: true,
          confirmButtonText: 'Find Available Slots',
          focusConfirm: false,
          ...swalDark,
          preConfirm: () => {
            const w = document.getElementById('swal-fweek').value;
            if (!w) { Swal.showValidationMessage('Select a date'); return false; }
            return { doc: document.getElementById('swal-fdoc').value, week: w };
          }
        });
        if (!r.isConfirmed || !r.value) return;
        docId = r.value.doc;
        weekOf = r.value.week;

        const res = await api(`backend/api/get_followup_slots.php?doctor_id=${docId}&week_of=${weekOf}`);
        if (!res.success) return;
        if (!res.slots.length) {
          // Try another doctor or week when no slots are available.
          await Swal.fire({
            icon: 'info',
            title: 'No available slots',
            text: 'The doctor is on leave or fully booked that week. Choose another doctor (same specialty) or another week.',
            ...swalDark
          });
          continue;
        }
        const pick = await Swal.fire({
          title: 'Select a Slot',
          input: 'select',
          inputOptions: Object.fromEntries(res.slots.map((sl, i) => [i + 1, sl.label])),
          inputPlaceholder: 'Select...',
          inputValidator: v => (!v || Number(v) < 1) && 'Select a slot.',
          showCancelButton: true,
          confirmButtonText: 'Propose',
          cancelButtonText: 'Back',
          ...swalDark
        });
        if (!pick.isConfirmed) continue;
        const slot = res.slots[Number(pick.value) - 1];
        let done = false;
        await busy(async () => {
          const out = await api('backend/api/coordinator_actions.php', {
            action: 'schedule_followup', appointment_id: app.id, doctor_id: docId, new_date: slot.date, new_time: slot.time
          });
          if (out.success) { toast(out.message || 'Follow-up proposed.'); await loadData(); done = true; }
        });
        if (done) return;
      }
    };

    const editWorkdays = async (doc) => {
      const boxes = DAY_NAMES.map((n, i) =>
        `<label style="display:inline-flex;align-items:center;gap:4px;margin:4px 8px"><input type="checkbox" class="swal-wd" value="${i + 1}" ${doc.workdays.includes(i + 1) ? 'checked' : ''}> ${n}</label>`).join('');
      const r = await Swal.fire({
        title: `Workdays: ${esc(doc.name)}`,
        html: `<div>${boxes}</div><div style="font-size:11px;opacity:.7;margin-top:10px">Appointments booked on removed days will move to "Needs Reassignment".</div>`,
        showCancelButton: true,
        ...swalDark,
        preConfirm: () => {
          const v = [...document.querySelectorAll('.swal-wd:checked')].map(x => Number(x.value));
          if (!v.length) { Swal.showValidationMessage('Select at least one day'); return false; }
          return v;
        }
      });
      if (!r.isConfirmed || !r.value) return;
      await busy(async () => {
        const data = await api('backend/api/coordinator_actions.php', { action: 'set_workdays', doctor_id: doc.id, days: r.value });
        if (data.success) {
          toast(`Updated. ${data.affected_appointments || 0} appointment(s) need to be reassigned.`);
          await loadData();
        }
      });
    };

    const addCommitment = async (doc) => {
      const lbl = 'font-size:11px;text-align:left;margin:8px 20px 0;opacity:.7';
      const r = await Swal.fire({
        title: `Commitment: ${esc(doc.name)}`,
        html: `<div style="${lbl}">Start</div>
               <input id="swal-cstart" type="date" min="${today}" value="${today}" class="swal2-input" style="margin-top:2px">
               <div style="${lbl}">Until (leave blank for a single day)</div>
               <input id="swal-cend" type="date" min="${today}" class="swal2-input" style="margin-top:2px">
               <input id="swal-creason" class="swal2-input" placeholder="What is the commitment? (e.g. outreach, meeting)">`,
        showCancelButton: true,
        focusConfirm: false,
        ...swalDark,
        preConfirm: () => {
          const start = document.getElementById('swal-cstart').value;
          const end = document.getElementById('swal-cend').value || start;
          if (!start || start < today) { Swal.showValidationMessage('Select a valid start date'); return false; }
          if (end < start) { Swal.showValidationMessage('The end date cannot be earlier than the start date'); return false; }
          return { start_date: start, end_date: end, reason: document.getElementById('swal-creason').value.trim() };
        }
      });
      if (!r.isConfirmed || !r.value) return;
      await busy(async () => {
        const data = await api('backend/api/coordinator_actions.php', { action: 'add_commitment', doctor_id: doc.id, ...r.value });
        if (data.success) {
          toast(`Blocked. ${data.affected_appointments || 0} appointment(s) need to be reassigned.`);
          await loadData();
        }
      });
    };

    const removeBlockout = async (b) => {
      const r = await Swal.fire({
        title: 'Reopen this date?',
        text: `${b.block_date} (${b.type})`,
        showCancelButton: true,
        confirmButtonText: 'Reopen',
        cancelButtonText: 'Cancel',
        ...swalDark
      });
      if (!r.isConfirmed) return;
      await busy(async () => {
        const data = await api('backend/api/coordinator_actions.php', { action: 'remove_blockout', blockout_id: b.id });
        if (data.success) { toast('Date reopened.'); await loadData(); }
      });
    };

    const decideLeave = async (l, decision) => {
      const approve = decision === 'approve';
      const r = await Swal.fire({
        title: approve ? 'Approve this leave?' : 'Reject this leave?',
        text: approve
          ? `${l.doctor_name}: ${l.start_date} → ${l.end_date}. Affected appointments will be marked for reassignment.`
          : `${l.doctor_name}: ${l.start_date} → ${l.end_date}`,
        showCancelButton: true,
        confirmButtonText: approve ? 'Approve' : 'Reject',
        cancelButtonText: 'Back',
        ...swalDark
      });
      if (!r.isConfirmed) return;
      await busy(async () => {
        const data = await api('backend/api/coordinator_actions.php', { action: 'leave_decision', leave_id: l.id, decision });
        if (data.success) {
          toast(approve ? `Approved. ${data.affected_appointments || 0} appointment(s) need to be reassigned.` : 'Request rejected.');
          await loadData();
        }
      });
    };

    const doctorOptions = (selectedId = null, specialtyId = null) => doctors.value
      .slice()
      .sort((a, b) => (b.specialty_id == specialtyId) - (a.specialty_id == specialtyId) || a.name.localeCompare(b.name))
      .map(d => `<option value="${d.id}" ${d.id == selectedId ? 'selected' : ''}>${esc(d.name)} — ${esc(d.specialty_name)}</option>`)
      .join('');

    const reassignApp = async (app) => {
      const { value: v } = await Swal.fire({
        title: `Reassign: ${esc(app.patient_name)}`,
        html: `<select id="swal-doc" class="swal2-input">${doctorOptions(null, app.specialty_id)}</select>
               <input id="swal-date" type="date" min="${today}" value="${app.appointment_date >= today ? esc(app.appointment_date) : ''}" class="swal2-input">
               <select id="swal-time" class="swal2-input">${timeOptions(app.appointment_time)}</select>`,
        focusConfirm: false,
        showCancelButton: true,
        ...swalDark,
        preConfirm: () => {
          const d = document.getElementById('swal-date').value;
          if (!d || d < today) { Swal.showValidationMessage('Select a valid date'); return false; }
          return [document.getElementById('swal-doc').value, d, document.getElementById('swal-time').value];
        }
      });
      if (!v) return;

      await busy(async () => {
        const data = await api('backend/api/coordinator_actions.php', {
          action: 'reassign', appointment_id: app.id, new_doctor_id: v[0], new_date: v[1], new_time: v[2]
        });
        if (data.success) { toast('Appointment reassigned successfully.'); await loadData(); }
      });
    };

    const openWalkinModal = async () => {
      const { value: v } = await Swal.fire({
        title: 'Walk-In Registration',
        html: `<input id="swal-wname" class="swal2-input" placeholder="Patient Name">
               <input id="swal-wphone" class="swal2-input" placeholder="Contact Number">
               <select id="swal-wdoc" class="swal2-input">${doctorOptions()}</select>
               <input id="swal-wdate" type="date" min="${today}" value="${today}" class="swal2-input">
               <select id="swal-wtime" class="swal2-input">${timeOptions()}</select>`,
        focusConfirm: false,
        showCancelButton: true,
        ...swalDark,
        preConfirm: () => {
          const name = document.getElementById('swal-wname').value.trim();
          const date = document.getElementById('swal-wdate').value;
          if (!name) { Swal.showValidationMessage('Enter the patient name'); return false; }
          if (!date || date < today) { Swal.showValidationMessage('Select a valid date'); return false; }
          return {
            patient_name: name,
            contact_number: document.getElementById('swal-wphone').value.trim(),
            doctor_id: document.getElementById('swal-wdoc').value,
            appointment_date: date,
            appointment_time: document.getElementById('swal-wtime').value
          };
        }
      });
      if (!v) return;

      await busy(async () => {
        const data = await api('backend/api/book.php', { ...v, booked_by_role: 'coordinator' });
        if (data && data.success) {
          Swal.fire({ icon: 'success', title: 'Walk-in Booked!', html: `Ref Code: <b>${esc(data.reference_code)}</b>`, ...swalDark });
          await loadData();
        }
      });
    };

    onMounted(() => { if(typeof document!=='undefined'){ document.documentElement.classList.toggle('dm-compact',compactMode.value); document.documentElement.classList.toggle('dm-light',lightMode.value); } checkSession(); });

    return {
      TIME_SLOTS, today,
      currentUser, activeRole, navPage, isLoading, loginForm, authMode, showAuth, registerForm, handleRegister,
      specialties, doctors, appointments, notifications, unreadNotifs, showNotifs,
      selectedSpecialtyId, bookingForms, slotInfo, search, statusFilter,
      filteredDoctors, doctorApps, followupAppointments, filteredAppointments, statusCounts, activeAppointments, historyAppointments, todayQueue, completionRate, specialtyReport,
      fmtTime, statusLabel, statusClass, canModify, doctorYears, doctorFocus, isTaken, canSubmit, onDateChange,
      handleLogin, handleLogout, openProfile, openSettings, toggleNotifDropdown, submitReservation, compactMode, toggleCompactMode, lightMode, toggleLightMode, notifEnabled, toggleNotifPref, calendarMode, calendarDate, calendarItems, calendarTitle, moveCalendar, activityLogs, messageConversations, messages, selectedConversationId, messageDraft, unreadMessages, loadMessages, openConversation, selectedConversationTitle, sendMessage, bookWithDoctor, showAppointmentDetails, printAppointment,
      doctorDecision, setFollowupAdvice, reassignApp, cancelAppointment,
      rescheduleAppointment, fileLeave, openWalkinModal,
      forwardToDoctor, decideLeave, stageText, leaves, pendingLeaves,
      sendToPatient, scheduleFollowup, checkInPatient, doctorComplete, respondFollowup, editWorkdays, addCommitment, removeBlockout,
      schedule, showSchedule, workdayLabel, hasCoordAction, myDoctor
    };
  }
};

Vue.createApp(App).mount('#app');
