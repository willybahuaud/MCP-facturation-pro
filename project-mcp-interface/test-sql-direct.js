#!/usr/bin/env node

/**
 * Test direct de la requête SQL
 */

import Database from './src/database/index.js';

async function testSqlDirect() {
  console.log('🔍 Test direct de la requête SQL...\n');
  
  try {
    const database = new Database();
    await database.connect();
    await database.initialize();
    
    // Test 1: Recherche "woocommerce" dans les descriptions
    console.log('🛒 Test 1: Recherche "woocommerce" dans les descriptions');
    const woocommerceResults = await database.all(`
      SELECT DISTINCT
        q.quote_number,
        q.total_ttc,
        c.name as customer_name,
        ql.description
      FROM quotes q
      LEFT JOIN customers c ON q.customer_id = c.facturation_id
      LEFT JOIN quote_lines ql ON q.id = ql.quote_id
      WHERE ql.description LIKE ?
      LIMIT 5
    `, ['%woocommerce%']);
    
    console.log(`Résultats: ${woocommerceResults.length}`);
    woocommerceResults.forEach((result, i) => {
      console.log(`  ${i+1}. ${result.quote_number} (${result.total_ttc}€) - ${result.customer_name || 'N/A'}`);
      console.log(`     Description: ${result.description.substring(0, 100)}...`);
    });
    
    // Test 2: Recherche "wordpress" dans les descriptions
    console.log('\n🌐 Test 2: Recherche "wordpress" dans les descriptions');
    const wordpressResults = await database.all(`
      SELECT DISTINCT
        q.quote_number,
        q.total_ttc,
        c.name as customer_name,
        ql.description
      FROM quotes q
      LEFT JOIN customers c ON q.customer_id = c.facturation_id
      LEFT JOIN quote_lines ql ON q.id = ql.quote_id
      WHERE ql.description LIKE ?
      LIMIT 5
    `, ['%wordpress%']);
    
    console.log(`Résultats: ${wordpressResults.length}`);
    wordpressResults.forEach((result, i) => {
      console.log(`  ${i+1}. ${result.quote_number} (${result.total_ttc}€) - ${result.customer_name || 'N/A'}`);
      console.log(`     Description: ${result.description.substring(0, 100)}...`);
    });
    
    // Test 3: Recherche "site" dans les descriptions
    console.log('\n🏠 Test 3: Recherche "site" dans les descriptions');
    const siteResults = await database.all(`
      SELECT DISTINCT
        q.quote_number,
        q.total_ttc,
        c.name as customer_name,
        ql.description
      FROM quotes q
      LEFT JOIN customers c ON q.customer_id = c.facturation_id
      LEFT JOIN quote_lines ql ON q.id = ql.quote_id
      WHERE ql.description LIKE ?
      LIMIT 5
    `, ['%site%']);
    
    console.log(`Résultats: ${siteResults.length}`);
    siteResults.forEach((result, i) => {
      console.log(`  ${i+1}. ${result.quote_number} (${result.total_ttc}€) - ${result.customer_name || 'N/A'}`);
      console.log(`     Description: ${result.description.substring(0, 100)}...`);
    });
    
    // Test 4: Vérifier la casse
    console.log('\n🔍 Test 4: Vérifier la casse');
    const caseResults = await database.all(`
      SELECT DISTINCT
        q.quote_number,
        q.total_ttc,
        c.name as customer_name,
        ql.description
      FROM quotes q
      LEFT JOIN customers c ON q.customer_id = c.facturation_id
      LEFT JOIN quote_lines ql ON q.id = ql.quote_id
      WHERE LOWER(ql.description) LIKE ?
      LIMIT 5
    `, ['%woocommerce%']);
    
    console.log(`Résultats (insensible à la casse): ${caseResults.length}`);
    caseResults.forEach((result, i) => {
      console.log(`  ${i+1}. ${result.quote_number} (${result.total_ttc}€) - ${result.customer_name || 'N/A'}`);
      console.log(`     Description: ${result.description.substring(0, 100)}...`);
    });
    
    await database.close();
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

testSqlDirect();
