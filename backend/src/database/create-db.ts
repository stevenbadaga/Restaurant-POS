import { exec } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';

dotenv.config();

const execAsync = promisify(exec);

async function checkPsqlAvailable(): Promise<boolean> {
  try {
    await execAsync('psql --version');
    return true;
  } catch {
    return false;
  }
}

async function createDatabase(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('DATABASE_URL is not defined in the environment.');
    process.exit(1);
  }

  const isPsqlAvailable = await checkPsqlAvailable();
  if (!isPsqlAvailable) {
    console.error('❌ psql is not available in your PATH.');
    console.error('');
    console.error('  To create the database manually:');
    console.error('  1. Connect to PostgreSQL: psql -U postgres');
    console.error('  2. Run: CREATE DATABASE restaurant_pos;');
    console.error('  3. Type: \\q to exit');
    process.exit(1);
  }

  const url = new URL(databaseUrl);
  const dbName = url.pathname.replace('/', '');
  const host = url.hostname || 'localhost';
  const port = url.port || '5432';
  const user = url.username || 'postgres';
  const password = url.password;

  try {
    // Check if database already exists using psql
    const checkCmd = `psql -U ${user} -h ${host} -p ${port} -t -c "SELECT 1 FROM pg_database WHERE datname='${dbName}'"`;
    const envVars = password ? { ...process.env, PGPASSWORD: password } : process.env;

    const { stdout } = await execAsync(checkCmd, { env: envVars });

    if (stdout.trim() === '1') {
      console.log(`Info: Database "${dbName}" already exists.`);
      return;
    }

    // Create the database
    const createCmd = `psql -U ${user} -h ${host} -p ${port} -c "CREATE DATABASE ${dbName}"`;
    await execAsync(createCmd, { env: envVars });
    console.log(`Database "${dbName}" created successfully.`);
  } catch (error) {
    console.error('Failed to create database.');
    console.error('');
    console.error('  Make sure:');
    console.error('  - PostgreSQL is installed and running');
    console.error('  - psql is available in your PATH');
    console.error('  - The connection details in server/.env are correct');
    console.error('');
    console.error('  Alternatively, create the database manually:');
    console.error(`  psql -U postgres -c "CREATE DATABASE ${dbName}";`);
    console.error('');
    if (error instanceof Error) {
      console.error('  Details:', error.message);
    }
    process.exit(1);
  }
}

createDatabase();
