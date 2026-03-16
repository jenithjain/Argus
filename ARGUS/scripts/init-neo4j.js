// Initialize Neo4j schema and constraints
// Run with: node scripts/init-neo4j.js

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env.local') });

import neo4j from 'neo4j-driver';

let driver = null;

function getDriver() {
  if (!driver) {
    const uri = process.env.NEO4J_URI;
    const user = process.env.NEO4J_USER;
    const password = process.env.NEO4J_PASSWORD;

    if (!uri || !user || !password) {
      throw new Error('Neo4j credentials not configured in .env.local');
    }

    driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
      maxConnectionLifetime: 3 * 60 * 60 * 1000,
      maxConnectionPoolSize: 50,
      connectionAcquisitionTimeout: 2 * 60 * 1000,
    });
  }
  return driver;
}

async function runQuery(cypher, params = {}) {
  const driver = getDriver();
  const session = driver.session({ database: process.env.NEO4J_DATABASE || 'neo4j' });
  
  try {
    const result = await session.run(cypher, params);
    return result.records.map(record => record.toObject());
  } finally {
    await session.close();
  }
}

async function closeDriver() {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

async function initializeGraphSchema() {
  const driver = getDriver();
  const session = driver.session({ database: process.env.NEO4J_DATABASE || 'neo4j' });
  
  try {
    const constraints = [
      'CREATE CONSTRAINT user_id IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE',
      'CREATE CONSTRAINT domain_name IF NOT EXISTS FOR (d:Domain) REQUIRE d.name IS UNIQUE',
      'CREATE CONSTRAINT ip_address IF NOT EXISTS FOR (i:IP) REQUIRE i.address IS UNIQUE',
      'CREATE CONSTRAINT org_name IF NOT EXISTS FOR (o:Organization) REQUIRE o.name IS UNIQUE',
      'CREATE CONSTRAINT campaign_id IF NOT EXISTS FOR (c:AttackCampaign) REQUIRE c.id IS UNIQUE',
    ];

    for (const constraint of constraints) {
      try {
        await session.run(constraint);
      } catch (err) {
        if (!err.message.includes('already exists')) {
          console.warn('Constraint creation warning:', err.message);
        }
      }
    }

    console.log('[Neo4j] Schema initialized successfully');
  } finally {
    await session.close();
  }
}

async function checkConnection() {
  console.log('🔌 Testing Neo4j connection...');
  try {
    const result = await runQuery('RETURN "Connection successful" as message');
    console.log('✅', result[0].message);
    return true;
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    return false;
  }
}

async function showStats() {
  console.log('\n📊 Current Graph Statistics:');
  
  try {
    const nodeCount = await runQuery('MATCH (n) RETURN count(n) as count');
    console.log(`   Nodes: ${nodeCount[0].count}`);
    
    const relCount = await runQuery('MATCH ()-[r]->() RETURN count(r) as count');
    console.log(`   Relationships: ${relCount[0].count}`);
    
    const nodeTypes = await runQuery('MATCH (n) RETURN DISTINCT labels(n)[0] as label, count(*) as count ORDER BY count DESC');
    console.log('\n   Node Types:');
    nodeTypes.forEach(row => {
      console.log(`   - ${row.label}: ${row.count}`);
    });
  } catch (error) {
    console.error('Failed to get stats:', error.message);
  }
}

async function listConstraints() {
  console.log('\n🔒 Database Constraints:');
  try {
    const constraints = await runQuery('SHOW CONSTRAINTS');
    if (constraints.length === 0) {
      console.log('   No constraints found');
    } else {
      constraints.forEach(c => {
        console.log(`   - ${c.name}: ${c.type}`);
      });
    }
  } catch (error) {
    console.error('Failed to list constraints:', error.message);
  }
}

async function main() {
  console.log('🚀 ARGUS Knowledge Graph - Neo4j Initialization\n');
  
  const connected = await checkConnection();
  if (!connected) {
    console.log('\n❌ Cannot proceed without database connection');
    console.log('   Check your .env.local file for correct Neo4j credentials');
    process.exit(1);
  }
  
  console.log('\n🏗️  Initializing graph schema...');
  try {
    await initializeGraphSchema();
    console.log('✅ Schema initialized successfully');
  } catch (error) {
    console.error('❌ Schema initialization failed:', error.message);
  }
  
  await listConstraints();
  await showStats();
  
  console.log('\n✅ Initialization complete!');
  console.log('\n📝 Next steps:');
  console.log('   1. Start the app: npm run dev');
  console.log('   2. Load Chrome extension');
  console.log('   3. Run test: node test-knowledge-graph.js');
  console.log('   4. Visit: http://localhost:3000/knowledge-graph\n');
  
  await closeDriver();
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
