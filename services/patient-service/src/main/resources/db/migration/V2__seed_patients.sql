-- Seed 8 Patients (P1..P8)
INSERT INTO patients (
    id, first_name, last_name, birth_date, gender, phone, email, address,
    blood_type, allergies, insurance_provider, insurance_number, deleted, created_at, updated_at
) VALUES
('a1a1a1a1-0000-4000-8000-000000000001', 'Youssef', 'Ben Salah', '1985-03-14', 'MALE', '+21620111001', 'youssef.bensalah@example.com', 'Tunis, Tunisia', 'A+', 'Penicillin', 'CNAM', '10001', false, '2026-10-12T08:00:00Z', '2026-10-12T08:00:00Z'),
('a1a1a1a1-0000-4000-8000-000000000002', 'Amira', 'Mejri', '1992-07-22', 'FEMALE', '+21620111002', 'amira.mejri@example.com', 'Tunis, Tunisia', 'O+', NULL, 'CNAM', '10002', false, '2026-10-12T08:00:00Z', '2026-10-12T08:00:00Z'),
('a1a1a1a1-0000-4000-8000-000000000003', 'Nizar', 'Khelifi', '1978-11-02', 'MALE', '+21620111003', 'nizar.khelifi@example.com', 'Tunis, Tunisia', 'B+', NULL, 'CNAM', '10003', false, '2026-10-12T08:00:00Z', '2026-10-12T08:00:00Z'),
('a1a1a1a1-0000-4000-8000-000000000004', 'Leila', 'Ben Ammar', '2001-01-30', 'FEMALE', '+21620111004', 'leila.benammar@example.com', 'Tunis, Tunisia', 'AB+', 'Latex', 'CNAM', '10004', false, '2026-10-12T08:00:00Z', '2026-10-12T08:00:00Z'),
('a1a1a1a1-0000-4000-8000-000000000005', 'Hatem', 'Dridi', '1965-05-18', 'MALE', '+21620111005', 'hatem.dridi@example.com', 'Tunis, Tunisia', 'O-', 'Aspirin', 'CNAM', '10005', false, '2026-10-12T08:00:00Z', '2026-10-12T08:00:00Z'),
('a1a1a1a1-0000-4000-8000-000000000006', 'Mariem', 'Sassi', '1999-09-09', 'FEMALE', '+21620111006', 'mariem.sassi@example.com', 'Tunis, Tunisia', 'A-', NULL, 'CNAM', '10006', false, '2026-10-12T08:00:00Z', '2026-10-12T08:00:00Z'),
('a1a1a1a1-0000-4000-8000-000000000007', 'Omar', 'Zouari', '1988-12-25', 'MALE', '+21620111007', 'omar.zouari@example.com', 'Tunis, Tunisia', 'B-', NULL, 'CNAM', '10007', false, '2026-10-12T08:00:00Z', '2026-10-12T08:00:00Z'),
('a1a1a1a1-0000-4000-8000-000000000008', 'Sarra', 'Belhaj', '1973-04-04', 'FEMALE', '+21620111008', 'sarra.belhaj@example.com', 'Tunis, Tunisia', 'A+', 'Sulfa drugs', 'CNAM', '10008', false, '2026-10-12T08:00:00Z', '2026-10-12T08:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- Seed 4 Medical File Entries
INSERT INTO medical_file_entries (
    id, patient_id, type, summary, source_service, reference_id, created_at
) VALUES
('7d6a1f5e-3b52-4c0e-8b0a-0000000000a1', 'a1a1a1a1-0000-4000-8000-000000000005', 'LAB', 'Blood tests: hemoglobin normal, white blood cells slightly high', 'lab', 'f9f9f9f9-0000-4000-8000-000000000001', '2026-10-10T15:00:00Z'),
('7d6a1f5e-3b52-4c0e-8b0a-0000000000a2', 'a1a1a1a1-0000-4000-8000-000000000001', 'NOTE', 'Penicillin allergy confirmed at registration', 'patient', NULL, '2026-10-12T09:30:00Z'),
('7d6a1f5e-3b52-4c0e-8b0a-0000000000a3', 'a1a1a1a1-0000-4000-8000-000000000005', 'CONSULTATION', 'Persistent cough consultation by Dr. Karim Jlassi', 'consultation', 'f7f7f7f7-0000-4000-8000-000000000001', '2026-10-10T10:30:00Z'),
('7d6a1f5e-3b52-4c0e-8b0a-0000000000a4', 'a1a1a1a1-0000-4000-8000-000000000005', 'PRESCRIPTION', 'Paracetamol 500mg, Cetirizine 10mg', 'pharmacy', 'f8f8f8f8-0000-4000-8000-000000000001', '2026-10-10T10:45:00Z')
ON CONFLICT (id) DO NOTHING;
