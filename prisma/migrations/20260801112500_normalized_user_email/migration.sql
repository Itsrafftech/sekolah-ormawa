-- Better Auth normalizes email input, while this index provides a final
-- database boundary against case or surrounding-whitespace variants.
CREATE UNIQUE INDEX "users_email_normalized_key"
  ON "users" (lower(btrim("email")));
