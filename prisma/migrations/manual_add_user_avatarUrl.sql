-- إن لم تستخدم `prisma db push`، نفّذ يدوياً على MySQL:
ALTER TABLE `user` ADD COLUMN `avatarUrl` VARCHAR(512) NULL;
