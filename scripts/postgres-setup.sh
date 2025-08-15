#!/bin/bash

# PostgreSQL Setup Script for GitHub Actions
# 
# Sets up PostgreSQL with PostGIS extensions for Buuk application workflows.
# Handles connection waiting, extension creation, and health checks.
#
# Usage:
#   ./postgres-setup.sh [options]
#
# Options:
#   --host          PostgreSQL host (default: localhost)
#   --port          PostgreSQL port (default: 5432)
#   --user          PostgreSQL user (default: postgres)
#   --password      PostgreSQL password (default: postgres)
#   --database      Database name (default: buukdb)
#   --timeout       Connection timeout in seconds (default: 60)
#   --skip-extensions   Skip PostGIS extension creation
#
# Environment Variables:
#   PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE - PostgreSQL connection parameters

set -e  # Exit on any error

# Default configuration
DEFAULT_HOST="localhost"
DEFAULT_PORT="5432"
DEFAULT_USER="postgres"
DEFAULT_PASSWORD="postgres"
DEFAULT_DATABASE="buukdb"
DEFAULT_TIMEOUT="60"

# Parse command line arguments
HOST="${DEFAULT_HOST}"
PORT="${DEFAULT_PORT}"
USER="${DEFAULT_USER}"
PASSWORD="${DEFAULT_PASSWORD}"
DATABASE="${DEFAULT_DATABASE}"
TIMEOUT="${DEFAULT_TIMEOUT}"
SKIP_EXTENSIONS=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --host)
      HOST="$2"
      shift 2
      ;;
    --port)
      PORT="$2"
      shift 2
      ;;
    --user)
      USER="$2"
      shift 2
      ;;
    --password)
      PASSWORD="$2"
      shift 2
      ;;
    --database)
      DATABASE="$2"
      shift 2
      ;;
    --timeout)
      TIMEOUT="$2"
      shift 2
      ;;
    --skip-extensions)
      SKIP_EXTENSIONS=true
      shift
      ;;
    --help)
      echo "PostgreSQL Setup Script for Buuk Workflows"
      echo ""
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --host HOST              PostgreSQL host (default: localhost)"
      echo "  --port PORT              PostgreSQL port (default: 5432)"
      echo "  --user USER              PostgreSQL user (default: postgres)"
      echo "  --password PASSWORD      PostgreSQL password (default: postgres)"
      echo "  --database DATABASE      Database name (default: buukdb)"
      echo "  --timeout SECONDS        Connection timeout (default: 60)"
      echo "  --skip-extensions        Skip PostGIS extension creation"
      echo "  --help                   Show this help message"
      echo ""
      echo "Environment Variables:"
      echo "  PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE"
      exit 0
      ;;
    *)
      echo "❌ Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Override with environment variables if set
HOST="${PGHOST:-$HOST}"
PORT="${PGPORT:-$PORT}"
USER="${PGUSER:-$USER}"
PASSWORD="${PGPASSWORD:-$PASSWORD}"
DATABASE="${PGDATABASE:-$DATABASE}"

# Export environment variables for psql commands
export PGHOST="$HOST"
export PGPORT="$PORT"
export PGUSER="$USER"
export PGPASSWORD="$PASSWORD"
export PGDATABASE="$DATABASE"

echo "🐘 Setting up PostgreSQL for Buuk workflows..."
echo "📋 Configuration:"
echo "   Host: $HOST"
echo "   Port: $PORT"
echo "   User: $USER"
echo "   Database: $DATABASE"
echo "   Timeout: ${TIMEOUT}s"
echo "   Skip Extensions: $SKIP_EXTENSIONS"

# Function to check if PostgreSQL is ready
check_postgres_ready() {
  pg_isready -h "$HOST" -p "$PORT" -U "$USER" -d "$DATABASE" >/dev/null 2>&1
}

# Function to test database connection
test_connection() {
  psql -h "$HOST" -p "$PORT" -U "$USER" -d "$DATABASE" -c "SELECT 1;" >/dev/null 2>&1
}

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
start_time=$(date +%s)
while ! check_postgres_ready; do
  current_time=$(date +%s)
  elapsed=$((current_time - start_time))
  
  if [ $elapsed -ge $TIMEOUT ]; then
    echo "❌ PostgreSQL connection timeout after ${TIMEOUT} seconds"
    echo "🔍 Debugging information:"
    echo "   Attempted connection: postgresql://$USER:***@$HOST:$PORT/$DATABASE"
    
    # Try to get more information
    if command -v netstat >/dev/null 2>&1; then
      echo "   Active connections on port $PORT:"
      netstat -tlnp 2>/dev/null | grep ":$PORT " || echo "   No processes listening on port $PORT"
    fi
    
    if command -v ps >/dev/null 2>&1; then
      echo "   PostgreSQL processes:"
      ps aux | grep -i postgres | grep -v grep || echo "   No PostgreSQL processes found"
    fi
    
    exit 1
  fi
  
  if [ $((elapsed % 10)) -eq 0 ] && [ $elapsed -gt 0 ]; then
    echo "   Still waiting... (${elapsed}s elapsed)"
  fi
  
  sleep 2
done

echo "✅ PostgreSQL is ready!"

# Test database connection
echo "🔌 Testing database connection..."
if ! test_connection; then
  echo "❌ Failed to connect to database $DATABASE"
  echo "🔍 Attempting to connect to default postgres database..."
  
  # Try connecting to postgres database to create the target database
  export PGDATABASE="postgres"
  if test_connection; then
    echo "✅ Connected to postgres database"
    echo "🏗️ Creating database $DATABASE..."
    
    # Check if database exists
    DB_EXISTS=$(psql -h "$HOST" -p "$PORT" -U "$USER" -d "postgres" -t -c "SELECT 1 FROM pg_database WHERE datname='$DATABASE';" | tr -d ' \n')
    
    if [ "$DB_EXISTS" != "1" ]; then
      psql -h "$HOST" -p "$PORT" -U "$USER" -d "postgres" -c "CREATE DATABASE $DATABASE;"
      echo "✅ Database $DATABASE created"
    else
      echo "ℹ️ Database $DATABASE already exists"
    fi
    
    # Switch back to target database
    export PGDATABASE="$DATABASE"
    
    if ! test_connection; then
      echo "❌ Still cannot connect to database $DATABASE after creation"
      exit 1
    fi
  else
    echo "❌ Cannot connect to PostgreSQL server"
    exit 1
  fi
fi

echo "✅ Database connection established"

# Create PostgreSQL extensions if not skipped
if [ "$SKIP_EXTENSIONS" = false ]; then
  echo "🔧 Creating PostgreSQL extensions..."
  
  # List of required extensions for Buuk application
  extensions=(
    "uuid-ossp"
    "postgis"
    "postgis_topology"
    "pgcrypto"
    "cube"
    "earthdistance"
    "unaccent"
  )
  
  echo "📦 Required extensions: ${extensions[*]}"
  
  # Create extensions in a single transaction to avoid conflicts
  cat << EOF | psql -h "$HOST" -p "$PORT" -U "$USER" -d "$DATABASE"
BEGIN;

-- Create extensions with proper error handling
DO \$\$
DECLARE
    ext_name TEXT;
    ext_list TEXT[] := ARRAY['uuid-ossp', 'postgis', 'postgis_topology', 'pgcrypto', 'cube', 'earthdistance', 'unaccent'];
BEGIN
    FOREACH ext_name IN ARRAY ext_list
    LOOP
        BEGIN
            EXECUTE 'CREATE EXTENSION IF NOT EXISTS "' || ext_name || '"';
            RAISE NOTICE 'Extension % created or already exists', ext_name;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE WARNING 'Failed to create extension %: %', ext_name, SQLERRM;
        END;
    END LOOP;
END
\$\$;

COMMIT;
EOF

  if [ $? -eq 0 ]; then
    echo "✅ PostgreSQL extensions created successfully"
  else
    echo "⚠️ Some extensions may have failed to create, but continuing..."
  fi
  
  # Verify critical extensions
  echo "🔍 Verifying critical extensions..."
  
  POSTGIS_VERSION=$(psql -h "$HOST" -p "$PORT" -U "$USER" -d "$DATABASE" -t -c "SELECT PostGIS_Version();" 2>/dev/null | tr -d ' \n')
  if [ -n "$POSTGIS_VERSION" ]; then
    echo "✅ PostGIS extension verified: $POSTGIS_VERSION"
  else
    echo "⚠️ PostGIS extension may not be available"
  fi
  
  UUID_AVAILABLE=$(psql -h "$HOST" -p "$PORT" -U "$USER" -d "$DATABASE" -t -c "SELECT uuid_generate_v4();" 2>/dev/null | tr -d ' \n')
  if [ -n "$UUID_AVAILABLE" ]; then
    echo "✅ UUID extension verified"
  else
    echo "⚠️ UUID extension may not be available"
  fi
  
else
  echo "⏭️ Skipping PostgreSQL extensions creation"
fi

# Final connection test
echo "🧪 Performing final connection test..."
if test_connection; then
  echo "✅ PostgreSQL setup completed successfully!"
  
  # Show database information
  echo "📊 Database information:"
  psql -h "$HOST" -p "$PORT" -U "$USER" -d "$DATABASE" -c "
    SELECT 
      current_database() as database,
      current_user as user,
      version() as version;
  " 2>/dev/null || echo "   Could not retrieve database information"
  
  # Show available extensions
  if [ "$SKIP_EXTENSIONS" = false ]; then
    echo "📦 Installed extensions:"
    psql -h "$HOST" -p "$PORT" -U "$USER" -d "$DATABASE" -c "
      SELECT extname as extension_name, extversion as version 
      FROM pg_extension 
      ORDER BY extname;
    " 2>/dev/null || echo "   Could not retrieve extension information"
  fi
  
else
  echo "❌ Final connection test failed"
  exit 1
fi

echo "🎉 PostgreSQL is ready for Buuk workflows!"