-- One-time pre-Flyway alignment for the inspected legacy MusicPets database.
-- Run ONLY after a full backup has been restored and checked in an isolated MySQL.
-- User.avatar is no longer mapped; pet avatars come from analyzed_pet / character data.
ALTER TABLE users DROP COLUMN avatar;
