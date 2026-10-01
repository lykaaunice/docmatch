-- DocMatch database schema
CREATE DATABASE IF NOT EXISTS docmatch_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE docmatch_db;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS appointment_reschedule_history;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS activity_logs;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS login_attempts;
DROP TABLE IF EXISTS doctor_leaves;
DROP TABLE IF EXISTS doctor_blockouts;
DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS doctors;
DROP TABLE IF EXISTS specialties;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE specialties (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) DEFAULT NULL
) ENGINE=InnoDB;

CREATE TABLE doctors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  specialty_id INT NOT NULL,
  room_number VARCHAR(20) DEFAULT NULL,
  available_days VARCHAR(100) DEFAULT 'Mon-Fri',
  status VARCHAR(20) NOT NULL DEFAULT 'Active',
  CONSTRAINT fk_doctor_specialty FOREIGN KEY (specialty_id) REFERENCES specialties(id)
) ENGINE=InnoDB;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  role ENUM('patient','doctor','coordinator') NOT NULL,
  doctor_id INT DEFAULT NULL,
  contact_number VARCHAR(20) DEFAULT NULL,
  CONSTRAINT fk_user_doctor FOREIGN KEY (doctor_id) REFERENCES doctors(id)
) ENGINE=InnoDB;

CREATE TABLE appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reference_code VARCHAR(20) DEFAULT NULL UNIQUE,
  patient_id INT DEFAULT NULL,
  patient_name VARCHAR(100) NOT NULL DEFAULT '',
  contact_number VARCHAR(20) DEFAULT NULL,
  specialty_id INT DEFAULT NULL,
  doctor_id INT NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Pending',
  booked_by_role VARCHAR(20) DEFAULT 'patient',
  decline_reason VARCHAR(255) DEFAULT NULL,
  cancel_reason VARCHAR(255) DEFAULT NULL,
  reason_for_visit VARCHAR(500) DEFAULT NULL,
  followup_timeframe VARCHAR(100) DEFAULT NULL,
  followup_notes TEXT DEFAULT NULL,
  forwarded_to_doctor TINYINT(1) NOT NULL DEFAULT 0,
  coordinator_note TEXT DEFAULT NULL,
  patient_notified TINYINT(1) NOT NULL DEFAULT 0,
  followup_relayed TINYINT(1) NOT NULL DEFAULT 0,
  parent_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  active_slot VARCHAR(40) GENERATED ALWAYS AS (
    IF(status IN ('Cancelled','Needs_Reassignment'), NULL,
      CONCAT(doctor_id, '|', appointment_date, '|', appointment_time))
  ) STORED,
  INDEX idx_slot (doctor_id, appointment_date, appointment_time),
  UNIQUE KEY uq_active_slot (active_slot),
  CONSTRAINT fk_appointment_patient FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_appointment_specialty FOREIGN KEY (specialty_id) REFERENCES specialties(id),
  CONSTRAINT fk_appointment_doctor FOREIGN KEY (doctor_id) REFERENCES doctors(id),
  CONSTRAINT fk_appointment_parent FOREIGN KEY (parent_id) REFERENCES appointments(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE doctor_blockouts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  doctor_id INT NOT NULL,
  block_date DATE NOT NULL,
  type VARCHAR(30) DEFAULT 'emergency',
  reason VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_blockout_doctor_date (doctor_id, block_date),
  CONSTRAINT fk_blockout_doctor FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE doctor_leaves (
  id INT AUTO_INCREMENT PRIMARY KEY,
  doctor_id INT NOT NULL,
  leave_type VARCHAR(20) NOT NULL DEFAULT 'Planned',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason VARCHAR(255) DEFAULT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_leave_doctor_dates (doctor_id, start_date, end_date),
  CONSTRAINT fk_leave_doctor FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT NOT NULL,
  sender_user_id INT NOT NULL,
  receiver_user_id INT NOT NULL,
  message VARCHAR(1000) NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_message_appointment (appointment_id, created_at),
  INDEX idx_message_receiver (receiver_user_id, is_read),
  CONSTRAINT fk_message_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
  CONSTRAINT fk_message_sender FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_message_receiver FOREIGN KEY (receiver_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE appointment_reschedule_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT NOT NULL,
  old_date DATE NOT NULL,
  old_time TIME NOT NULL,
  new_date DATE NOT NULL,
  new_time TIME NOT NULL,
  changed_by_user_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_reschedule_appointment (appointment_id, created_at),
  CONSTRAINT fk_reschedule_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
  CONSTRAINT fk_reschedule_user FOREIGN KEY (changed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  target_role VARCHAR(20) NOT NULL,
  target_user_id INT DEFAULT NULL,
  title VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notification_target (target_user_id, is_read, created_at),
  CONSTRAINT fk_notification_user FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE login_attempts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ip VARCHAR(45) NOT NULL,
  username VARCHAR(50) DEFAULT NULL,
  kind VARCHAR(10) NOT NULL DEFAULT 'login',
  attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_login_ip (ip, kind, attempted_at),
  INDEX idx_login_user (username, kind, attempted_at)
) ENGINE=InnoDB;

CREATE TABLE activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT DEFAULT NULL,
  user_id INT DEFAULT NULL,
  role VARCHAR(20) DEFAULT NULL,
  action VARCHAR(80) NOT NULL,
  details VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_activity_appointment (appointment_id, created_at),
  INDEX idx_activity_user (user_id, created_at),
  CONSTRAINT fk_activity_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
  CONSTRAINT fk_activity_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Demo data used for local presentation and testing.
INSERT INTO specialties (name, description) VALUES
  ('General Medicine','General check-up and consultation'),
  ('Pediatrics','Care for children'),
  ('Cardiology','Heart and blood pressure care'),
  ('Dermatology','Skin, hair and nails');

INSERT INTO doctors (name, specialty_id, room_number, available_days) VALUES
  ('Dr. Maria Santos',1,'Room 101','Mon-Fri'),
  ('Dr. Jose Reyes',1,'Room 102','Mon,Wed,Fri'),
  ('Dr. Ana Cruz',2,'Room 201','Mon-Thu'),
  ('Dr. Luis Garcia',3,'Room 301','Tue,Thu,Sat'),
  ('Dr. Carla Mendoza',4,'Room 401','Mon-Fri');

-- The application upgrades these demo passwords to password hashes on first use.
INSERT INTO users (username, password, full_name, role, doctor_id, contact_number) VALUES
  ('patient1','123456','Juan Dela Cruz','patient',NULL,'09123456789'),
  ('coordinator1','123456','Nurse Liza Ramos','coordinator',NULL,NULL),
  ('doctor1','123456','Dr. Maria Santos','doctor',1,NULL);
