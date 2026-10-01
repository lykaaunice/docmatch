# DocMatch

**Doctor Appointment & Scheduling Management System**

DocMatch is a web-based appointment and scheduling management system created to organize the workflow between **patients, doctors, and clinic coordinators**. It combines appointment booking, doctor schedule management, consultation tracking, follow-up management, messaging, notifications, and role-based tools in one application.

This project was developed as an academic and portfolio project using Vue.js, PHP, and MySQL/MariaDB.

## Key Features

### Patient
- Account registration and secure login
- Role-based patient dashboard
- Browse doctors and specialties
- Book appointments from available schedules
- Add a reason for visit during booking
- Track appointment status and progress
- View active appointments and appointment history
- Cancel or request appointment rescheduling when applicable
- View follow-up advice immediately after it is submitted by the doctor
- View and respond to proposed follow-up schedules
- Receive appointment and follow-up notifications
- Message the appropriate clinic/doctor contact through the system
- Print an appointment slip for confirmed appointments
- Manage profile and application preferences

### Doctor
- Role-based doctor dashboard
- View assigned and scheduled patients
- Accept or decline forwarded appointments
- View patient appointment information and reason for visit
- Monitor checked-in patients and consultation status
- Mark consultations as completed
- Add follow-up advice and recommended follow-up timeframe
- Review follow-up-related records
- Manage planned/emergency leave and schedule availability
- Use the in-system messaging and notification features

### Coordinator
- Role-based coordinator dashboard
- Review and manage patient appointments
- Forward appointments to the appropriate doctor
- Reassign eligible declined appointments
- Check in patients and monitor the patient queue
- Manage/plot doctor workdays and schedules
- Manage schedule blockouts, commitments, and availability
- View clinic schedules through calendar/schedule tools
- Manage follow-up scheduling using available doctor slots
- Send proposed follow-up schedules to patients for confirmation
- Register and manage walk-in patients
- Search and filter appointment records
- Review clinic activity and appointment-related information

## Appointment Workflow

1. The patient selects a doctor/specialty and books an available appointment slot.
2. The appointment is submitted for coordinator processing.
3. The coordinator reviews the request and forwards it to the appropriate doctor when required.
4. The doctor accepts or declines the appointment.
5. The patient is notified of the appointment status.
6. If an appointment is declined, eligible appointments may be reassigned to another doctor in the same specialty.
7. On the appointment date, the coordinator checks the patient in and the appointment enters the clinic queue/workflow.
8. The doctor completes the consultation and records follow-up advice when needed.
9. Follow-up advice becomes available to the patient immediately. A value such as **1 day** or **1 week** represents the recommended return timeframe, not a delay in delivering the advice.
10. When another visit is needed, the coordinator can propose an available follow-up schedule and send it to the patient for confirmation.
11. Completed appointments remain available in appointment history for reference.

## Doctor Scheduling

DocMatch includes coordinator-managed doctor scheduling. The coordinator can manage doctor workdays, available schedules, commitments/blockouts, and reopening dates. Doctors can also submit planned leave or emergency leave information. The booking workflow uses schedule availability to help prevent invalid or conflicting appointment slots.

## Additional System Features

- Appointment status tracking and history
- Patient queue and check-in workflow
- Follow-up advice and follow-up scheduling
- Appointment cancellation and rescheduling support
- Walk-in patient handling
- Doctor leave and availability management
- In-system messaging with automatic message refresh
- Notification center and unread indicators
- Activity tracking/audit-related records
- Search and filtering tools
- Printable appointment slips
- Light and dark interface modes
- Responsive role-based navigation
- Empty, loading, confirmation, and error states
- Double-booking protection for active doctor appointment slots

## User Roles

| Role | Main Responsibilities |
| --- | --- |
| **Patient** | Books and tracks appointments, views follow-up advice, responds to schedules, receives notifications, and manages personal appointment information. |
| **Doctor** | Reviews assigned appointments, handles consultations, manages availability/leave, and provides follow-up advice. |
| **Coordinator** | Manages appointment flow, doctor schedules, patient check-in/queue, reassignment, and follow-up scheduling. |

## Technologies Used

- HTML5
- CSS / Tailwind CSS
- JavaScript
- Vue.js
- Vue Router
- PHP 8+
- MySQL / MariaDB
- XAMPP

## Project Structure

```text
docmatch/
├── backend/
│   ├── api/             # PHP API endpoints
│   ├── database/        # Fresh-install database schema
│   ├── db.php           # Database connection/setup
│   └── migrate.php      # Local migration utility
├── css/                 # Application styles
├── js/                  # Vue application, API, templates, and utilities
├── tests/               # Backend and frontend checks
├── index.html           # Application entry point
└── README.md
```

## Local Installation

1. Install and open **XAMPP**.
2. Copy the `docmatch` folder into `C:\xampp\htdocs\`.
3. Start **Apache** and **MySQL** from the XAMPP Control Panel.
4. Open **phpMyAdmin** and prepare the `docmatch_db` database.
5. For the packaged project/database release, import the provided `docmatch_db.sql`. If only the repository is available, `backend/database/schema.sql` can be used for a fresh installation.
6. Open `http://localhost/docmatch/` in a browser.
7. If the local MySQL root account uses a password, update the database configuration in `backend/db.php`.

> **Important:** Back up any existing DocMatch database before importing a fresh-install SQL file. A fresh schema may replace existing development data.

## Demo Accounts

The development setup may include demo accounts for demonstrating the Patient, Coordinator, and Doctor roles. Use only the credentials included in the database/version being demonstrated. Demo credentials should be changed or removed before any public or production deployment.

## Security & Validation

DocMatch includes role/session checks, CSRF protection for applicable POST requests, password hashing, login/sign-up rate limiting, browser-safe API errors, schedule validation, and database/application safeguards against active double-booking of a doctor's date/time slot.

## Testing

Backend checks can be run with:

```bash
php tests/run_tests.php
```

Frontend consistency checks can be run with:

```bash
node tests/check_frontend.js
```

For a presentation or submission, the complete Patient → Coordinator → Doctor workflow should also be tested manually using a fresh database installation.

## Portfolio Summary

DocMatch demonstrates full-stack web application development through a role-based clinic appointment workflow. The project highlights frontend interface design, PHP/MySQL integration, authentication and authorization, schedule validation, appointment state management, notifications, messaging, follow-up workflows, and database-driven application logic.

## Disclaimer

DocMatch is an **academic and portfolio project**. It is intended to demonstrate software development and appointment-management concepts and is not a replacement for a production clinical information system, electronic medical record, or professional medical service.
