#!/bin/sh
# The sites service (src/sites) must stay isolated from the API (WEBS.md 3.3):
# no main database connection, no .env, no controllers, no libs that use them.
# Fails the build if any file in src/sites imports one of them.
bad=$(grep -rnE "(from|import)[[:space:]]*\(?[\"'][^\"']*(db/index|dotenv|controllers/|middlewares/|lib/(features|onlineBooking|reminders|encryption|exercises|images|clinical|appointments|email))" src/sites)
if [ -n "$bad" ]; then
  echo "src/sites imports something it must not (WEBS.md 3.3):"
  echo "$bad"
  exit 1
fi
echo "check:sites ok"
