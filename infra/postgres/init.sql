-- One Postgres container, six databases, one per service (Decisions Log D9).
-- Runs only on an empty volume. To run it again: ./scripts/reset.sh
CREATE DATABASE sgh_patient;
CREATE DATABASE sgh_reception;
CREATE DATABASE sgh_consultation;
CREATE DATABASE sgh_lab;
CREATE DATABASE sgh_pharmacy;
CREATE DATABASE sgh_staff;
