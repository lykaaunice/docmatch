// Main DocMatch interface template.
const APP_TEMPLATE = `
    <div class="min-h-screen flex flex-col bg-[#0a0a0c] text-zinc-100 font-mono text-sm border-t-2 border-blue-500 relative">
      
      <!-- Loading state -->
      <div v-if="isLoading" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
        <div class="flex flex-col items-center gap-3 p-6 bg-[#121216] border border-zinc-800 rounded-xl shadow-2xl">
          <div class="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span class="text-xs font-bold text-zinc-300">Processing...</span>
        </div>
      </div>

      <!-- Public landing page -->
      <div v-if="!currentUser" class="public-site">
        <nav class="public-nav">
          <a href="#home" class="public-brand">docmatch<span>.sys</span></a>
          <div class="public-links"><a href="#about">About</a><a href="#doctors">Doctors</a><a href="#how">How it works</a></div>
          <button @click="authMode='login'; showAuth=true" class="public-login">Log in</button>
        </nav>

        <section id="home" class="public-hero">
          <div class="hero-copy"><div class="brand-pill">✚ DOCMATCH CLINIC PORTAL</div><h1>Smarter appointments.<br><span>Better clinic coordination.</span></h1><p>Book the right doctor, follow your appointment progress, and keep every clinic role connected in one simple system.</p><div class="hero-actions"><button @click="authMode='register'; showAuth=true" class="hero-primary">Book an appointment</button><a href="#about" class="hero-secondary">Learn more ↓</a></div></div>
          <div class="hero-panel"><span>APPOINTMENT FLOW</span><div><b>01</b><p>Choose a specialty & doctor</p></div><div><b>02</b><p>Select an available schedule</p></div><div><b>03</b><p>Track confirmation & check-in</p></div><div><b>04</b><p>Receive follow-up advice</p></div></div>
        </section>

        <section id="about" class="public-section about-grid"><div><div class="section-kicker">About DocMatch</div><h2>One system connecting patients, doctors, and clinic coordinators.</h2></div><div class="about-copy"><p>DocMatch is designed to make clinic appointment coordination clearer and more organized. Patients can request schedules and track progress, doctors can manage appointment decisions and follow-ups, while coordinators can handle patient flow, schedules, and reassignment.</p><div class="about-points"><span>✓ Appointment tracking</span><span>✓ Doctor scheduling</span><span>✓ Patient check-in</span><span>✓ Follow-up coordination</span></div></div></section>

        <section id="doctors" class="public-section"><div class="section-heading"><div><div class="section-kicker">Meet the team</div><h2>Our Doctors</h2></div><p>Choose a doctor based on the care you need and their available clinic schedule.</p></div><div class="doctor-showcase"><article v-for="doc in doctors" :key="doc.id" class="doctor-public-card"><div class="doctor-photo"><div class="doctor-avatar">{{ (doc.name || 'D').replace('Dr.','').trim().charAt(0) }}</div><span>MD</span></div><div class="doctor-info"><small>{{ doc.specialty_name }}</small><h3>{{ doc.name }}</h3><p>{{ doc.room_number || 'Clinic room assigned' }}</p><div class="doctor-details"><div><span>Experience</span><b>{{ doctorYears(doc) }}+ years</b></div><div><span>Clinic room</span><b>{{ doc.room_number || 'Assigned' }}</b></div></div><p class="doctor-focus">{{ doctorFocus(doc) }}</p><div class="doctor-meta"><span>Availability</span><b>{{ doc.available_days || 'By schedule' }}</b></div><button @click="authMode='register'; showAuth=true">Book with this doctor →</button></div></article></div></section>

        <section id="how" class="public-section how-section"><div class="section-kicker">Simple process</div><h2>How DocMatch works</h2><div class="how-grid"><div><b>01</b><h3>Create your account</h3><p>Register as a patient and securely access your personal appointment dashboard.</p></div><div><b>02</b><h3>Book your visit</h3><p>Select a specialty, doctor, date, and available appointment time.</p></div><div><b>03</b><h3>Track your appointment</h3><p>Follow every stage from submission and doctor review to check-in and completion.</p></div></div></section>
        <footer class="public-footer"><b>docmatch<span>.sys</span></b><p>Clinic appointment & coordination system</p><button @click="authMode='login'; showAuth=true">Staff / Patient Login →</button></footer>

        <div v-if="showAuth" class="auth-modal" @click.self="showAuth=false"><div class="auth-card"><button class="auth-close" @click="showAuth=false">×</button><div class="text-center space-y-1"><h1 class="font-bold text-2xl text-white">docmatch<span class="text-blue-500">.sys</span></h1><p class="text-xs text-zinc-400">{{ authMode === 'login' ? 'Log in with your account.' : 'Create a patient account.' }}</p></div>
          <form v-if="authMode === 'login'" @submit.prevent="handleLogin" class="space-y-4 mt-6"><div><label class="form-label">Username</label><input type="text" v-model="loginForm.username" required autocomplete="username" class="form-input"></div><div><label class="form-label">Password</label><input type="password" v-model="loginForm.password" required autocomplete="current-password" class="form-input"></div><button type="submit" class="auth-submit">Log in →</button><p class="auth-switch">New patient? <button type="button" @click="authMode='register'">Create an account</button></p><div class="login-demo"><b>Demo Accounts (Password: 123456):</b><span>• Patient: <strong class="demo-patient">patient1</strong></span><span>• Coordinator/Nurse: <strong class="demo-coordinator">coordinator1</strong></span><span>• Doctor: <strong class="demo-doctor">doctor1</strong> or <strong class="demo-doctor-alt">dr_&lt;surname&gt;</strong> (e.g. dr_cruz)</span></div></form>
          <form v-else @submit.prevent="handleRegister" class="space-y-3 mt-5"><div><label class="form-label">Full name</label><input type="text" v-model="registerForm.full_name" required class="form-input"></div><div><label class="form-label">Contact number</label><input type="tel" v-model="registerForm.contact_number" required class="form-input"></div><div><label class="form-label">Username</label><input type="text" v-model="registerForm.username" required class="form-input"></div><div class="grid grid-cols-2 gap-2"><div><label class="form-label">Password</label><input type="password" v-model="registerForm.password" required minlength="8" class="form-input"></div><div><label class="form-label">Confirm</label><input type="password" v-model="registerForm.confirm" required minlength="8" class="form-input"></div></div><button type="submit" class="auth-submit register">Create patient account</button><p class="auth-switch">Already registered? <button type="button" @click="authMode='login'">Log in</button></p></form>
        </div></div>
      </div>

      <!-- Signed-in workspace -->
      <div v-else class="flex-1 flex flex-col">
        
        <!-- Top navigation -->
        <header class="border-b border-zinc-800 px-4 sm:px-6 py-3 bg-[#0d0d11]">
          <div class="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
            <div class="flex items-center gap-3">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <h1 class="font-bold text-base text-white tracking-tight">docmatch<span class="text-blue-500">.sys</span></h1>
            </div>

            <div class="flex items-center gap-4">
              <!-- Notifications -->
              <div class="relative">
                <button @click="toggleNotifDropdown" class="p-2 bg-zinc-900 border border-zinc-800 rounded-lg relative text-zinc-300 hover:text-white">
                  🔔
                  <span v-if="unreadNotifs > 0" class="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                    {{ unreadNotifs }}
                  </span>
                </button>

                <div v-if="showNotifs" class="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-80 bg-[#121216] border border-zinc-800 rounded-xl shadow-2xl p-3 z-50 space-y-2">
                  <div class="flex justify-between items-center border-b border-zinc-800 pb-2 text-xs">
                    <span class="font-bold text-zinc-200">Notifications ({{ activeRole }})</span>
                    <span class="text-[10px] text-zinc-500">{{ notifications.length }} total</span>
                  </div>
                  <div v-if="notifications.length === 0" class="text-xs text-zinc-500 py-4 text-center">No new notifications.</div>
                  <div class="max-h-60 overflow-y-auto space-y-2">
                    <div v-for="n in notifications" :key="n.id" class="p-2 bg-zinc-900/80 rounded border border-zinc-800 text-[11px] space-y-0.5">
                      <div class="font-bold text-blue-400">{{ n.title }}</div>
                      <div class="text-zinc-300 leading-snug">{{ n.message }}</div>
                      <div class="text-[9px] text-zinc-600">{{ n.created_at }}</div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Account menu -->
              <div class="text-right border-l border-zinc-800 pl-4">
                <div class="text-xs font-bold text-white">{{ currentUser.full_name }}</div>
                <div class="text-[10px] text-zinc-500 uppercase font-mono tracking-wider">{{ activeRole }}</div>
              </div>

              <button @click="handleLogout" class="px-3 py-1.5 bg-zinc-900 hover:bg-red-950 text-zinc-400 hover:text-red-400 border border-zinc-800 hover:border-red-800 rounded-lg text-xs transition">
                Logout
              </button>
            </div>
          </div>
        </header>

        <!-- Main content -->
        <div class="app-layout max-w-7xl mx-auto w-full flex-1">
          <aside class="dm-sidebar">
            <div class="sidebar-role">{{ activeRole }} workspace</div>
            <button @click="navPage='dashboard'" :class="['side-link', navPage==='dashboard' ? 'active' : '']">⌂ <span>Dashboard</span></button>
            <button v-if="activeRole === 'patient'" @click="navPage='booking'" :class="['side-link side-book', navPage==='booking' ? 'active' : '']">＋ <span>Book Appointment</span></button>
            <button v-if="activeRole === 'patient'" @click="navPage='appointments'" :class="['side-link', navPage==='appointments' ? 'active' : '']">▣ <span>My Appointments</span></button>
            <button v-if="activeRole === 'patient'" @click="navPage='history'" :class="['side-link', navPage==='history' ? 'active' : '']">◴ <span>Appointment History</span></button>
            <button v-if="activeRole === 'patient'" @click="navPage='followups'" :class="['side-link', navPage==='followups' ? 'active' : '']">↻ <span>Follow-ups</span></button>
            <button v-if="activeRole === 'patient'" @click="navPage='directory'" :class="['side-link', navPage==='directory' ? 'active' : '']">✚ <span>Doctors</span></button>
            <button v-if="activeRole === 'coordinator'" @click="navPage='appointments'" :class="['side-link', navPage==='appointments' ? 'active' : '']">▤ <span>Appointments</span></button>
            <button v-if="activeRole === 'coordinator'" @click="navPage='queue'" :class="['side-link', navPage==='queue' ? 'active' : '']">◷ <span>Patient Queue</span></button>
            <button v-if="activeRole === 'coordinator'" @click="navPage='schedule'" :class="['side-link', navPage==='schedule' ? 'active' : '']">▦ <span>Doctor Schedules</span></button>
            <button v-if="activeRole === 'coordinator'" @click="navPage='calendar'" :class="['side-link', navPage==='calendar' ? 'active' : '']">▦ <span>Clinic Calendar</span></button>
            <button v-if="activeRole === 'coordinator'" @click="navPage='activity'" :class="['side-link', navPage==='activity' ? 'active' : '']">↻ <span>Activity Log</span></button>
            <button v-if="activeRole === 'coordinator'" @click="navPage='reports'" :class="['side-link', navPage==='reports' ? 'active' : '']">⌁ <span>Reports & Analytics</span></button>
            <button v-if="activeRole === 'doctor'" @click="navPage='appointments'" :class="['side-link', navPage==='appointments' ? 'active' : '']">▤ <span>My Appointments</span></button>
            <button v-if="activeRole === 'doctor'" @click="navPage='schedule'" :class="['side-link', navPage==='schedule' ? 'active' : '']">▦ <span>Schedule & Leave</span></button>
            <button v-if="activeRole === 'doctor'" @click="navPage='calendar'" :class="['side-link', navPage==='calendar' ? 'active' : '']">▦ <span>Calendar</span></button>
            <button v-if="activeRole === 'doctor'" @click="navPage='followups'" :class="['side-link', navPage==='followups' ? 'active' : '']">↻ <span>Follow-up Advice</span></button>
            <button v-if="activeRole === 'doctor'" @click="navPage='history'" :class="['side-link', navPage==='history' ? 'active' : '']">◴ <span>Consultation History</span></button>
            <button v-if="['patient','doctor'].includes(activeRole)" @click="navPage='messages'; loadMessages()" :class="['side-link', navPage==='messages' ? 'active' : '']">✉ <span>Messages</span><em v-if="unreadMessages">{{ unreadMessages }}</em></button>
            <button @click="navPage='notifications'" :class="['side-link', navPage==='notifications' ? 'active' : '']">♢ <span>Notifications</span><em v-if="unreadNotifs && notifEnabled">{{ unreadNotifs }}</em></button>
            <div class="sidebar-divider"></div>
            <button @click="navPage='profile'" :class="['side-link', navPage==='profile' ? 'active' : '']">◎ <span>Profile</span></button>
            <button @click="navPage='settings'" :class="['side-link', navPage==='settings' ? 'active' : '']">⚙ <span>Settings</span></button>
            <button @click="handleLogout" class="side-link side-logout">↪ <span>Logout</span></button>
            <div class="sidebar-bottom"><div class="avatar">{{ currentUser.full_name.charAt(0) }}</div><div><b>{{ currentUser.full_name }}</b><small>{{ activeRole }}</small></div></div>
          </aside>
          <main id="dashboard" class="dm-main px-4 sm:px-6 py-6">

          <!-- Sidebar pages -->
          <section v-if="navPage==='messages' && ['patient','doctor'].includes(activeRole)" class="standalone-page"><div class="page-head"><div class="section-kicker">Secure Clinic Chat</div><h2>Messages</h2><p>Message your assigned doctor or patient about an appointment without sharing personal phone numbers.</p></div><div class="message-layout"><div class="page-card message-conversations"><h3>Conversations</h3><div v-if="messageConversations.length===0" class="empty-state">No appointment conversations yet. Messaging becomes available for your booked appointments.</div><button v-for="c in messageConversations" :key="c.appointment_id" @click="openConversation(c)" :class="['conversation-item', selectedConversationId==c.appointment_id?'active':'']"><div><b>{{ activeRole==='patient' ? c.doctor_name : c.patient_name }}</b><small>{{ c.reference_code }} · {{ c.appointment_date }}</small></div><em v-if="Number(c.unread_count)">{{ c.unread_count }}</em></button></div><div class="page-card chat-panel"><div v-if="!selectedConversationId" class="empty-state">Select a conversation to start messaging.</div><template v-else><div class="chat-head"><div><b>{{ selectedConversationTitle }}</b><small>Appointment-related messages only</small></div><button @click="loadMessages(selectedConversationId)" class="page-secondary">Refresh</button></div><div class="chat-body"><div v-if="messages.length===0" class="empty-state">No messages yet. You can start the conversation below.</div><div v-for="m in messages" :key="m.id" :class="['chat-message', Number(m.sender_user_id)===Number(currentUser.id)?'mine':'theirs']"><b>{{ Number(m.sender_user_id)===Number(currentUser.id) ? 'You' : m.sender_name }}</b><p>{{ m.message }}</p><small>{{ m.created_at }}</small></div></div><form class="chat-compose" @submit.prevent="sendMessage"><textarea v-model="messageDraft" maxlength="1000" rows="2" placeholder="Type an appointment-related message..." required></textarea><button class="page-primary" :disabled="!messageDraft.trim()">Send</button></form><p class="chat-note">For emergencies, contact the clinic or emergency services directly. DocMatch chat is not for urgent medical care.</p></template></div></div></section>

          <section v-if="navPage==='notifications'" class="standalone-page"><div class="page-head"><div class="section-kicker">Inbox</div><h2>Notifications</h2><p>Appointment updates, clinic actions, follow-ups, and schedule notices appear here.</p></div><div class="page-card"><div v-if="notifications.length===0" class="empty-state">No notifications yet.</div><div v-for="n in notifications" :key="n.id" class="notification-row"><div><b>{{ n.title || 'DocMatch update' }}</b><p>{{ n.message }}</p></div><small>{{ n.created_at || '' }}</small></div></div></section>
          <section v-if="navPage==='profile'" class="standalone-page"><div class="page-head"><div class="section-kicker">Account</div><h2>My Profile</h2><p>Your personal DocMatch account information and clinic activity.</p></div><div class="profile-grid"><div class="page-card profile-identity"><div class="profile-big-avatar">{{ currentUser.full_name.charAt(0) }}</div><h3>{{ currentUser.full_name }}</h3><span>{{ activeRole }}</span><button @click="openProfile" class="page-primary">Edit Profile Information</button></div><div class="page-card detail-list"><h3>Account Details</h3><div><span>Full name</span><b>{{ currentUser.full_name }}</b></div><div><span>Username</span><b>{{ currentUser.username }}</b></div><div><span>Role</span><b>{{ activeRole }}</b></div><div><span>Account status</span><b class="ok-text">Active</b></div></div><div class="page-card detail-list"><h3>Clinic Activity</h3><div><span>Total appointments</span><b>{{ appointments.length }}</b></div><div><span>Completed</span><b>{{ appointments.filter(a=>a.status==='Completed').length }}</b></div><div><span>Active / upcoming</span><b>{{ appointments.filter(a=>!['Completed','Cancelled'].includes(a.status)).length }}</b></div></div></div></section>
          <section v-if="navPage==='settings'" class="standalone-page"><div class="page-head"><div class="section-kicker">Preferences & Security</div><h2>Settings</h2><p>Control your account security, appearance, notifications, and workspace density.</p></div><div class="settings-grid"><div class="page-card setting-block"><div><h3>Password & Security</h3><p>Update your password regularly to keep your DocMatch account protected.</p></div><button @click="openSettings" class="page-primary">Change Password</button></div><div class="page-card setting-block"><div><h3>Appearance</h3><p>Switch the entire workspace between high-contrast light and dark themes.</p></div><button @click="toggleLightMode" class="page-secondary">{{ lightMode ? 'Use Dark Mode' : 'Use Light Mode' }}</button></div><div class="page-card setting-block"><div><h3>Display Density</h3><p>Choose a comfortable layout or fit more clinic information on screen.</p></div><button @click="toggleCompactMode" class="page-secondary">{{ compactMode ? 'Use Comfortable View' : 'Use Compact View' }}</button></div><div class="page-card setting-block"><div><h3>Notification Indicators</h3><p>Show or mute unread badges while keeping all notifications available in the notification center.</p></div><button @click="toggleNotifPref" class="page-secondary">{{ notifEnabled ? 'Mute Indicators' : 'Enable Indicators' }}</button></div><div class="page-card setting-block"><div><h3>Session & Privacy</h3><p>Signed in as {{ currentUser.username }}. Log out when using a shared clinic computer.</p></div><button @click="handleLogout" class="danger-button">Log out securely</button></div></div></section>

          <section v-if="navPage==='calendar' && ['coordinator','doctor'].includes(activeRole)" class="standalone-page"><div class="page-head"><div class="section-kicker">Visual Schedule</div><h2>{{ activeRole==='doctor' ? 'My Clinic Calendar' : 'Clinic Calendar' }}</h2><p>Switch between day, week, and month views to review clinic appointments.</p></div><div class="page-card calendar-toolbar"><div><button v-for="m in ['day','week','month']" :key="m" @click="calendarMode=m" :class="calendarMode===m?'page-primary':'page-secondary'">{{ m }}</button></div><div><button @click="moveCalendar(-1)" class="page-secondary">←</button><input type="date" v-model="calendarDate" class="calendar-date"><button @click="moveCalendar(1)" class="page-secondary">→</button></div></div><div class="page-card"><h3 class="report-title">{{ calendarTitle }}</h3><div v-if="calendarItems.length===0" class="empty-state">No appointments in this {{ calendarMode }} view.</div><div v-for="app in calendarItems" :key="app.id" class="calendar-event" @click="showAppointmentDetails(app)"><div class="calendar-day"><b>{{ app.appointment_date.slice(8,10) }}</b><small>{{ app.appointment_date }}</small></div><div><strong>{{ fmtTime(app.appointment_time) }} · {{ activeRole==='doctor' ? app.patient_name : app.doctor_name }}</strong><p>{{ app.specialty_name }} · {{ app.patient_name }}</p></div><span :class="['px-2 py-0.5 rounded text-[10px] font-bold border', statusClass(app.status)]">{{ statusLabel(app.status) }}</span></div></div></section>

          <section v-if="activeRole==='coordinator' && navPage==='activity'" class="standalone-page"><div class="page-head"><div class="section-kicker">Audit Trail</div><h2>Activity Log</h2><p>Recent appointment actions recorded by DocMatch for accountability and presentation.</p></div><div class="page-card"><div v-if="activityLogs.length===0" class="empty-state">No activity has been recorded yet. New actions will appear here.</div><div v-for="log in activityLogs" :key="log.id" class="activity-line"><span>{{ log.created_at }}</span><b>{{ log.full_name || log.role || 'System' }}</b><em>{{ (log.action || '').replaceAll('_',' ') }}</em><strong>{{ log.details || ('Appointment #'+(log.appointment_id||'—')) }}</strong></div></div></section>

          <section v-if="navPage==='followups' && ['patient','doctor'].includes(activeRole)" class="standalone-page"><div class="page-head"><div class="section-kicker">Continuity of Care</div><h2>{{ activeRole==='doctor' ? 'Follow-up Advice' : 'My Follow-ups' }}</h2><p>{{ activeRole==='doctor' ? 'Completed consultations stay here until follow-up advice is recorded. You can also review advice already sent.' : 'Review your doctor’s follow-up timeframe, instructions, and follow-up appointment status.' }}</p></div><div class="page-card"><div v-if="followupAppointments.length===0" class="empty-state">{{ activeRole==='doctor' ? 'No completed consultations are waiting for follow-up advice.' : 'No follow-up advice yet.' }}</div><div v-for="app in followupAppointments" :key="app.id" class="history-row"><div @click="showAppointmentDetails(app)" style="cursor:pointer"><b>{{ app.reference_code }}</b><h3>{{ activeRole==='doctor' ? app.patient_name : app.doctor_name }}</h3><p>{{ app.specialty_name }} · {{ app.appointment_date }} @ {{ fmtTime(app.appointment_time) }}</p><div v-if="app.followup_timeframe" class="followup-note"><strong>{{ app.followup_timeframe }}</strong><span>{{ app.followup_notes || 'No additional instructions.' }}</span></div><div v-else class="followup-pending">Follow-up advice has not been added yet.</div></div><div><span :class="['px-2 py-0.5 rounded text-[10px] font-bold border', statusClass(app.status)]">{{ statusLabel(app.status) }}</span><button v-if="activeRole==='doctor' && app.status==='Completed' && !app.followup_timeframe" @click="setFollowupAdvice(app.id)" class="page-primary followup-action">Add Advice</button><small v-else>View details →</small></div></div></div></section>

          <section v-if="navPage==='history'" class="standalone-page"><div class="page-head"><div class="section-kicker">Records</div><h2>{{ activeRole==='doctor' ? 'Consultation History' : 'Appointment History' }}</h2><p>Review completed, cancelled, declined, and past clinic activity.</p></div><div class="page-card"><div v-if="historyAppointments.length===0" class="empty-state">No history records yet.</div><div v-for="app in historyAppointments" :key="app.id" class="history-row" @click="showAppointmentDetails(app)"><div><b>{{ app.reference_code }}</b><h3>{{ activeRole==='doctor' ? app.patient_name : app.doctor_name }}</h3><p>{{ app.specialty_name }} · {{ app.appointment_date }} @ {{ fmtTime(app.appointment_time) }}</p></div><div><span :class="['px-2 py-0.5 rounded text-[10px] font-bold border', statusClass(app.status)]">{{ statusLabel(app.status) }}</span><small>View details →</small></div></div></div></section>

          <section v-if="activeRole==='patient' && navPage==='directory'" class="standalone-page"><div class="page-head"><div class="section-kicker">Care Team</div><h2>Doctor Directory</h2><p>Browse available doctors, their specialty, clinic room, experience, and schedule.</p></div><div class="directory-grid"><article v-for="doc in doctors" :key="doc.id" class="page-card directory-card"><div class="profile-big-avatar">{{ doc.name.replace('Dr.','').trim().charAt(0) }}</div><small>{{ doc.specialty_name }}</small><h3>{{ doc.name }}</h3><p>{{ doctorFocus(doc) }}</p><div class="detail-list"><div><span>Experience</span><b>{{ doctorYears(doc) }}+ years</b></div><div><span>Room</span><b>{{ doc.room_number }}</b></div><div><span>Availability</span><b>{{ doc.available_days }}</b></div></div><button @click="bookWithDoctor(doc)" class="page-primary">Book with this doctor</button></article></div></section>

          <section v-if="activeRole==='coordinator' && navPage==='reports'" class="standalone-page"><div class="page-head"><div class="section-kicker">Clinic Insights</div><h2>Reports & Analytics</h2><p>Operational summary based on the appointments currently stored in DocMatch.</p></div><div class="report-grid"><div class="metric-card"><span>Total Records</span><strong>{{ appointments.length }}</strong><small>all appointment records</small></div><div class="metric-card"><span>Completion Rate</span><strong>{{ completionRate }}%</strong><small>completed consultations</small></div><div class="metric-card"><span>Walk-ins</span><strong>{{ appointments.filter(a=>a.booked_by_role==='coordinator').length }}</strong><small>coordinator registrations</small></div><div class="metric-card"><span>Follow-ups</span><strong>{{ appointments.filter(a=>a.followup_timeframe).length }}</strong><small>with doctor advice</small></div></div><div class="page-card"><h3 class="report-title">Appointments by Specialty</h3><div v-for="r in specialtyReport" :key="r.name" class="report-bar"><div><span>{{ r.name }}</span><b>{{ r.count }}</b></div><div class="bar-track"><i :style="{width:r.percent+'%'}"></i></div></div></div><div class="page-card"><h3 class="report-title">Recent Clinic Activity</h3><div v-for="app in appointments.slice(0,8)" :key="app.id" class="activity-line" @click="showAppointmentDetails(app)"><span>{{ app.appointment_date }}</span><b>{{ app.patient_name }}</b><em>{{ app.doctor_name }}</em><strong>{{ statusLabel(app.status) }}</strong></div></div></section>

          <!-- Patient workspace -->
          <div v-if="activeRole === 'patient' && ['dashboard','booking','appointments'].includes(navPage)" class="space-y-6">
            <div v-if="navPage==='dashboard'" class="border-l-2 border-blue-500 pl-4 py-1">
              <h2 class="text-lg font-bold text-white">Patient Dashboard</h2>
              <p class="text-xs text-zinc-400">Welcome back. Book a visit, track your appointments, and manage your clinic activity.</p>
            </div>

            <div v-if="navPage==='dashboard'" class="dashboard-grid">
              <div class="metric-card"><span>Upcoming / Active</span><strong>{{ appointments.filter(a => !['Completed','Cancelled'].includes(a.status)).length }}</strong><small>appointments in progress</small></div>
              <div class="metric-card"><span>Confirmed</span><strong>{{ appointments.filter(a => a.status === 'Booked').length }}</strong><small>ready for clinic visit</small></div>
              <div class="metric-card"><span>Follow-ups</span><strong>{{ appointments.filter(a => a.followup_timeframe).length }}</strong><small>with doctor advice</small></div>
            </div>

            <!-- Specialty selection -->
            <div v-if="navPage==='booking'" id="booking" class="pt-4 space-y-3">
              <div class="section-kicker">Book an appointment</div><h3 class="text-lg font-bold text-white">1. Choose a Specialty</h3>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button 
                  v-for="s in specialties" :key="s.id"
                  @click="selectedSpecialtyId = s.id"
                  :class="['p-3 rounded-xl border text-left transition', selectedSpecialtyId === s.id ? 'bg-zinc-900 border-blue-500' : 'bg-[#121216] border-zinc-800 hover:border-zinc-700']"
                >
                  <div class="font-bold text-xs text-blue-400">{{ s.name }}</div>
                  <div class="text-[10px] text-zinc-500 mt-1 line-clamp-1">{{ s.description }}</div>
                </button>
              </div>
            </div>

            <!-- Doctor and schedule selection -->
            <div v-if="navPage==='booking' && selectedSpecialtyId" class="grid md:grid-cols-2 gap-4">
              <div v-for="doc in filteredDoctors" :key="doc.id" class="p-4 bg-[#121216] border border-zinc-800 rounded-xl space-y-3">
                <div class="flex justify-between items-start">
                  <div>
                    <h4 class="font-bold text-zinc-100">{{ doc.name }}</h4>
                    <span class="text-[10px] text-zinc-500">{{ doc.room_number }}</span>
                  </div>
                  <span class="text-[10px] bg-blue-950 text-blue-400 border border-blue-800/50 px-2 py-0.5 rounded">Duty: {{ doc.available_days }}</span>
                </div>
                
                <div class="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label class="text-[10px] text-zinc-500 block mb-1">Date *</label>
                    <input type="date" :min="today" v-model="bookingForms[doc.id].date" @change="onDateChange(doc)" class="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-zinc-200 focus:outline-none focus:border-blue-500">
                  </div>
                  <div>
                    <label class="text-[10px] text-zinc-500 block mb-1">Time *</label>
                    <select v-model="bookingForms[doc.id].time" class="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-zinc-200 focus:outline-none focus:border-blue-500">
                      <option value="">Select a Time</option>
                      <option v-for="t in TIME_SLOTS" :key="t.value" :value="t.value" :disabled="isTaken(doc.id, t.value)">
                        {{ t.label }}{{ isTaken(doc.id, t.value) ? ' (taken)' : '' }}
                      </option>
                    </select>
                  </div>
                </div>
                <div>
                  <label class="text-[10px] text-zinc-500 block mb-1">Reason for Visit</label>
                  <textarea v-model="bookingForms[doc.id].reason_for_visit" maxlength="500" rows="2" class="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-zinc-200 focus:outline-none focus:border-blue-500" placeholder="Briefly describe the reason for your appointment"></textarea>
                </div>
                <div v-if="slotInfo[doc.id] && slotInfo[doc.id].blocked" class="text-[11px] text-red-400">The doctor is not available on this date.</div>

                <button
                  @click="submitReservation(doc)"
                  :disabled="!canSubmit(doc)"
                  :class="['w-full font-bold py-2 rounded text-xs transition', !canSubmit(doc) ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white']"
                >
                  {{ !canSubmit(doc) ? 'Select Date and Time' : 'Reserve (Pending Status) →' }}
                </button>
              </div>
            </div>

            <!-- Active appointments -->
            <div v-if="navPage==='appointments'" id="appointments" class="space-y-3">
              <h3 class="text-xs font-bold text-zinc-400 uppercase tracking-wider">My Active Appointments</h3>
              <div v-if="appointments.length === 0" class="p-4 bg-[#121216] border border-zinc-800 rounded-xl text-xs text-zinc-500">Nothing found.</div>
              <div v-for="app in activeAppointments" :key="app.id" class="p-4 bg-[#121216] border border-zinc-800 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div>
                  <div class="flex gap-2 items-center"><button @click="showAppointmentDetails(app)" class="font-bold text-blue-400 text-xs hover:underline">{{ app.reference_code }} · View details</button><button v-if="['Booked','Checked_In','Completed'].includes(app.status)" @click="printAppointment(app)" class="text-[10px] px-2 py-1 rounded border border-zinc-700 hover:border-blue-500">Print Slip</button></div>
                  <div class="text-white font-bold">{{ app.doctor_name }} ({{ app.specialty_name }})</div>
                  <div class="text-xs text-zinc-400">{{ app.appointment_date }} @ {{ fmtTime(app.appointment_time) }}</div>
                  <div v-if="app.followup_timeframe" class="text-[11px] text-amber-400 mt-1">Follow-up: {{ app.followup_timeframe }} <span class="text-zinc-500">{{ app.followup_notes }}</span></div>
                  <div v-if="app.status === 'Needs_Reassignment'" class="text-[11px] text-red-400 mt-1">The coordinator is finding you a new schedule.</div>
                  <div v-if="app.status === 'Pending'" class="text-[11px] text-zinc-500 mt-1">Reservation received. Awaiting confirmation.</div>
                  <div class="status-track mt-3"><span class="done">Submitted</span><span :class="Number(app.forwarded_to_doctor) || app.status !== 'Pending' ? 'done' : ''">Coordinator</span><span :class="Number(app.doctor_accepted) || ['Booked','Checked_In','Completed'].includes(app.status) ? 'done' : ''">Doctor</span><span :class="(['Booked','Checked_In','Completed'].includes(app.status) && Number(app.patient_notified)) ? 'done' : ''">Confirmed</span><span :class="['Checked_In','Completed'].includes(app.status) ? 'done' : ''">Check-in</span><span :class="app.status === 'Completed' ? 'done' : ''">Completed</span></div>
                  <div v-if="app.status === 'Proposed'" class="text-[11px] text-sky-400 mt-1">The clinic proposed this follow-up. Please confirm or decline.</div>
                </div>
                <div class="flex items-center gap-2">
                  <span :class="['px-2 py-0.5 rounded text-[10px] font-bold border', statusClass(app.status)]">{{ statusLabel(app.status) }}</span>
                  <template v-if="app.status === 'Proposed'">
                    <button @click="respondFollowup(app, true)" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded">Confirm</button>
                    <button @click="respondFollowup(app, false)" class="px-2.5 py-1 bg-red-950 hover:bg-red-900 text-red-400 border border-red-800 text-xs rounded">Decline</button>
                  </template>
                  <button v-if="canModify(app)" @click="cancelAppointment(app.id)" class="px-2.5 py-1 bg-red-950 hover:bg-red-900 text-red-400 border border-red-800 text-xs rounded">Cancel</button>
                  <button v-if="canModify(app)" @click="rescheduleAppointment(app)" class="px-2.5 py-1 bg-blue-950 hover:bg-blue-900 text-blue-400 border border-blue-800 text-xs rounded">Reschedule</button>
                </div>
              </div>
            </div>
            <div v-if="navPage==='dashboard'" class="quick-actions"><button @click="navPage='booking'">＋ Book an Appointment</button><button @click="navPage='appointments'">▣ View My Appointments</button><button @click="navPage='notifications'">♢ Open Notifications</button></div>

          </div>

          <!-- Coordinator workspace -->
          <div v-if="activeRole === 'coordinator' && ['dashboard','appointments','queue','schedule'].includes(navPage)" class="space-y-6">
            <div v-if="navPage==='dashboard'" class="border-l-2 border-emerald-500 pl-4 py-1 flex justify-between items-center">
              <div>
                <h2 class="text-lg font-bold text-white">Coordinator Dashboard</h2>
                <p class="text-xs text-zinc-400">Manage appointments, register walk-in patients, check patients in, and reassign schedules.</p>
              </div>
              <button @click="openWalkinModal" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold shadow-lg">
                + Walk-In Patient Registration
              </button>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div v-for="c in statusCounts" :key="c.label" class="p-3 bg-[#121216] border border-zinc-800 rounded-xl">
                <div class="text-[10px] uppercase text-zinc-500">{{ c.label }}</div>
                <div :class="['text-xl font-bold', c.color]">{{ c.count }}</div>
              </div>
            </div>

            <div v-if="navPage==='queue' || navPage==='dashboard'" id="queue" class="queue-strip">
              <div><span>waiting</span><b>{{ appointments.filter(a => a.status === 'Booked').length }}</b></div>
              <div><span>checked in</span><b>{{ appointments.filter(a => a.status === 'Checked_In').length }}</b></div>
              <div><span>completed</span><b>{{ appointments.filter(a => a.status === 'Completed').length }}</b></div>
              <div><span>needs action</span><b>{{ appointments.filter(a => hasCoordAction(a)).length }}</b></div>
            </div>
            <div v-if="navPage==='queue'" class="page-card"><div class="queue-head"><h3>Today's Patient Queue</h3><span>{{ today }}</span></div><div v-if="todayQueue.length===0" class="empty-state">No patients scheduled for today.</div><div v-for="(app,i) in todayQueue" :key="app.id" class="queue-row"><b>#{{ String(i+1).padStart(2,'0') }}</b><div><strong>{{ app.patient_name }}</strong><small>{{ app.doctor_name }} · {{ fmtTime(app.appointment_time) }}</small></div><span :class="['px-2 py-0.5 rounded text-[10px] font-bold border', statusClass(app.status)]">{{ statusLabel(app.status) }}</span><button @click="showAppointmentDetails(app)">Details</button></div></div>

            <div v-if="navPage==='appointments'" class="flex flex-col sm:flex-row gap-2">
              <input v-model="search" placeholder="Search: name, ref code, doctor..." class="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500">
              <select v-model="statusFilter" class="bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs">
                <option value="">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Booked">Booked</option>
                <option value="Needs_Reassignment">Needs Reassignment</option>
                <option value="Proposed">Proposed</option>
                <option value="Checked_In">Checked In</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div v-if="navPage==='schedule'" id="schedule" class="p-4 bg-[#121216] border border-zinc-800 rounded-xl">
              <button @click="showSchedule = !showSchedule" class="w-full flex justify-between items-center text-xs font-bold text-zinc-300">
                <span>🗓️ Doctor Schedules <span class="text-zinc-500 font-normal">(workdays and commitments)</span></span>
                <span class="text-zinc-500">{{ showSchedule ? '▲' : '▼' }}</span>
              </button>
              <div v-if="showSchedule" class="mt-3 space-y-3">
                <div v-for="d in schedule" :key="d.id" class="border-t border-zinc-800 pt-3 text-xs">
                  <div class="flex flex-wrap justify-between items-center gap-2">
                    <div>
                      <span class="font-bold text-zinc-200">{{ d.name }}</span> <span class="text-zinc-500">({{ d.specialty_name }})</span>
                      <div class="text-[10px] text-zinc-400 mt-0.5">Workdays: {{ workdayLabel(d.workdays) }}</div>
                    </div>
                    <div class="flex gap-2">
                      <button @click="editWorkdays(d)" class="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-[10px] font-bold">Workdays</button>
                      <button @click="addCommitment(d)" class="px-2.5 py-1 bg-amber-700 hover:bg-amber-600 text-white rounded text-[10px] font-bold">+ Commitment / Blockout</button>
                    </div>
                  </div>
                  <div v-if="d.blockouts.length" class="mt-2 flex flex-wrap gap-1">
                    <span v-for="b in d.blockouts" :key="b.id" class="px-2 py-0.5 bg-zinc-900 border border-zinc-700 rounded text-[10px] text-zinc-300">
                      {{ b.block_date }} · {{ b.type }}<span v-if="b.reason"> · {{ b.reason }}</span>
                      <button @click="removeBlockout(b)" class="ml-1 text-red-400">✕</button>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="navPage==='schedule' && pendingLeaves.length" class="p-4 bg-[#121216] border border-amber-800/60 rounded-xl space-y-2">
              <div class="text-xs font-bold text-amber-400">Leave Requests Awaiting Decision</div>
              <div v-for="l in pendingLeaves" :key="l.id" class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs border-t border-zinc-800 pt-2">
                <div>
                  <span class="font-bold text-zinc-200">{{ l.doctor_name }}</span>
                  <span class="text-zinc-400"> · {{ l.start_date }} → {{ l.end_date }}</span>
                  <div class="text-[10px] text-zinc-500">{{ l.reason || '—' }}</div>
                </div>
                <div class="flex gap-2">
                  <button @click="decideLeave(l, 'approve')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold">Approve</button>
                  <button @click="decideLeave(l, 'reject')" class="px-2.5 py-1 bg-red-700 hover:bg-red-600 text-white rounded text-[10px] font-bold">Reject</button>
                </div>
              </div>
            </div>

            <div v-if="navPage==='appointments'" id="appointments" class="overflow-x-auto border border-zinc-800 rounded-xl bg-[#121216]">
              <table class="w-full text-left text-xs">
                <thead class="bg-zinc-900 text-zinc-400 border-b border-zinc-800 text-[10px] uppercase">
                  <tr>
                    <th class="p-3">Ref</th>
                    <th class="p-3">Patient</th>
                    <th class="p-3">Doctor & Specialty</th>
                    <th class="p-3">Schedule</th>
                    <th class="p-3">Follow-Up / Notes</th>
                    <th class="p-3">Status</th>
                    <th class="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-zinc-800/60">
                  <tr v-if="filteredAppointments.length === 0"><td colspan="7" class="p-6 text-center text-zinc-500">Nothing found.</td></tr>
                  <tr v-for="app in filteredAppointments" :key="app.id" class="hover:bg-zinc-900/40">
                    <td class="p-3 font-bold text-blue-400">{{ app.reference_code }}</td>
                    <td class="p-3 font-bold text-zinc-200">{{ app.patient_name }}</td>
                    <td class="p-3">{{ app.doctor_name }} <span class="text-zinc-500 text-[10px]">({{ app.specialty_name }})</span></td>
                    <td class="p-3 font-mono">{{ app.appointment_date }} @ {{ fmtTime(app.appointment_time) }}</td>
                    <td class="p-3">
                      <span v-if="app.followup_timeframe" class="text-amber-400 font-bold text-[11px] block">{{ app.followup_timeframe }}</span>
                      <span class="text-zinc-500 text-[10px]">{{ app.followup_notes || '—' }}</span>
                    </td>
                    <td class="p-3">
                      <span :class="['px-2 py-0.5 rounded text-[10px] font-bold border', statusClass(app.status)]">{{ statusLabel(app.status) }}</span>
                      <div v-if="app.decline_reason && app.status === 'Needs_Reassignment'" class="text-[10px] text-zinc-500 mt-1">{{ app.decline_reason }}</div>
                      <div v-if="app.status === 'Pending'" class="text-[10px] text-zinc-500 mt-1">{{ stageText(app) }}</div>
                    </td>
                    <td class="p-3">
                      <div class="flex flex-col gap-1 items-start">
                        <button v-if="app.status === 'Pending' && !Number(app.forwarded_to_doctor)" @click="forwardToDoctor(app)" class="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-bold">Forward to Doctor</button>
                        <button v-if="app.status === 'Needs_Reassignment'" @click="reassignApp(app)" class="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[10px] font-bold">Reassign to Another Doctor</button>
                        <button v-if="(app.status === 'Booked' || app.status === 'Proposed') && app.patient_id && !Number(app.patient_notified)" @click="sendToPatient(app)" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold">Send to Patient</button>
                        <button v-if="app.status === 'Booked'" @click="checkInPatient(app)" class="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-[10px] font-bold">Check-in</button>
                        <button v-if="app.status === 'Completed' && app.followup_timeframe && !Number(app.followup_relayed)" @click="scheduleFollowup(app)" class="px-2.5 py-1 bg-purple-700 hover:bg-purple-600 text-white rounded text-[10px] font-bold">Schedule Follow-up</button>
                        <span v-if="!hasCoordAction(app)" class="text-zinc-600 text-[10px]">OK</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Doctor workspace -->
          <div v-if="activeRole === 'doctor' && ['dashboard','appointments','schedule'].includes(navPage)" class="space-y-6">
            <div v-if="navPage==='dashboard'" class="border-l-2 border-purple-500 pl-4 py-1 flex justify-between items-center">
              <div>
                <h2 class="text-lg font-bold text-white">Doctor Evaluation Portal</h2>
                <p class="text-xs text-zinc-400">Accept or decline forwarded appointments. Set follow-up advice.</p>
              </div>
              <button @click="fileLeave" class="px-3 py-1.5 bg-red-900/80 hover:bg-red-800 text-red-200 border border-red-700 rounded text-xs font-bold">
                🗓️ Leave / Emergency Blockout
              </button>
            </div>

            <div v-if="navPage==='dashboard'" class="dashboard-grid">
              <div class="metric-card"><span>Needs Review</span><strong>{{ doctorApps.filter(a => a.status === 'Pending').length }}</strong><small>forwarded requests</small></div>
              <div class="metric-card"><span>Checked In</span><strong>{{ doctorApps.filter(a => a.status === 'Checked_In').length }}</strong><small>patients waiting</small></div>
              <div class="metric-card"><span>Completed</span><strong>{{ appointments.filter(a => a.status === 'Completed').length }}</strong><small>consultations</small></div>
            </div>

            <div v-if="navPage==='schedule' || navPage==='dashboard'" id="schedule" :class="['p-3 rounded-xl text-xs border', myDoctor ? 'bg-purple-950/30 border-purple-900 text-purple-200' : 'bg-red-950/40 border-red-800 text-red-300']">
              <template v-if="myDoctor">You are logged in as <b>{{ myDoctor.name }}</b>. Only appointments for this doctor appear here, after the Coordinator forwards them.</template>
              <template v-else>This account is not linked to any doctor, so nothing will appear. Log in with a doctor account (e.g. dr_cruz).</template>
            </div>

            <div v-if="navPage==='schedule' && leaves.length" class="p-3 bg-[#121216] border border-zinc-800 rounded-xl text-xs space-y-1">
              <div class="text-[10px] uppercase text-zinc-500">My Leave / Blockout</div>
              <div v-for="l in leaves.slice(0, 5)" :key="l.id" class="flex justify-between">
                <span class="font-mono text-zinc-300">{{ l.start_date }} → {{ l.end_date }} <span class="text-zinc-500">({{ l.leave_type }})</span></span>
                <span :class="['font-bold', l.status === 'Approved' ? 'text-emerald-400' : l.status === 'Rejected' ? 'text-red-400' : 'text-amber-400']">{{ l.status }}</span>
              </div>
            </div>

            <div v-if="navPage==='appointments'" id="appointments" class="grid md:grid-cols-2 gap-4">
              <div v-if="doctorApps.length === 0" class="col-span-2 p-8 bg-[#121216] border border-zinc-800 rounded-xl text-center text-zinc-500">
                No appointments need review right now.
              </div>
              <div v-for="app in doctorApps" :key="app.id" class="p-4 bg-[#121216] border border-zinc-800 rounded-xl space-y-3">
                <div class="flex justify-between items-start gap-2">
                  <div>
                    <span class="font-bold text-zinc-100">{{ app.patient_name }}</span>
                    <div class="text-[10px] text-zinc-500">{{ app.reference_code }} · {{ app.contact_number || 'no contact' }}</div>
                  </div>
                  <div class="text-right">
                    <span class="text-xs text-blue-400 font-mono">{{ app.appointment_date }} @ {{ fmtTime(app.appointment_time) }}</span>
                    <div><span :class="['px-2 py-0.5 rounded text-[10px] font-bold border', statusClass(app.status)]">{{ statusLabel(app.status) }}</span></div>
                  </div>
                </div>
                <div v-if="app.coordinator_note" class="text-[11px] text-blue-300 bg-blue-950/40 border border-blue-900 rounded p-2">Coordinator note: {{ app.coordinator_note }}</div>
                <div v-if="app.followup_timeframe" class="text-[11px] text-amber-400">Follow-up: {{ app.followup_timeframe }}</div>
                <div class="flex gap-2 pt-2">
                  <template v-if="app.status === 'Pending'">
                    <button @click="doctorDecision(app.id, 'accept')" class="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 rounded text-xs font-bold">Accept</button>
                    <button @click="doctorDecision(app.id, 'decline')" class="flex-1 bg-red-600 hover:bg-red-500 text-white py-1.5 rounded text-xs font-bold">Decline</button>
                  </template>
                  <button v-if="app.status === 'Checked_In'" @click="doctorComplete(app)" class="flex-1 bg-sky-600 hover:bg-sky-500 text-white py-1.5 rounded text-xs font-bold">Consultation Done</button>
                  <button v-if="app.status === 'Completed'" @click="setFollowupAdvice(app.id)" class="px-2 bg-purple-900 hover:bg-purple-800 text-purple-200 border border-purple-700 rounded text-xs">Follow-up Advice</button>
                </div>
              </div>
            </div>
          </div>

          </main>
        </div>
      </div>

    </div>
  `;
