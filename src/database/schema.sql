-- Schéma de base de données pour Facturation.PRO MCP
-- Tables pour stocker les données synchronisées localement

-- Table des clients
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY,
    facturation_id INTEGER UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    postal_code TEXT,
    country TEXT,
    vat_number TEXT,
    created_at DATETIME,
    updated_at DATETIME,
    last_sync DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table des catégories
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY,
    facturation_id INTEGER UNIQUE NOT NULL,
    name TEXT NOT NULL,
    status INTEGER DEFAULT 0, -- 0: Achats/Ventes, 1: Ventes uniquement, 2: Achats uniquement
    created_at DATETIME,
    updated_at DATETIME,
    last_sync DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table des produits
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    facturation_id INTEGER UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    vat_rate REAL DEFAULT 0,
    category_id INTEGER,
    unit TEXT,
    created_at DATETIME,
    updated_at DATETIME,
    last_sync DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Table des devis
CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY,
    facturation_id INTEGER UNIQUE NOT NULL,
    customer_id INTEGER NOT NULL,
    quote_number TEXT UNIQUE NOT NULL,
    quote_ref INTEGER, -- Numéro séquentiel du devis
    quote_date DATE NOT NULL,
    due_date DATE,
    status INTEGER DEFAULT 0, -- 0: En attente, 1: Accepté, 9: Refusé
    total_ht REAL NOT NULL,
    total_ttc REAL NOT NULL,
    vat_amount REAL NOT NULL,
    notes TEXT,
    created_at DATETIME,
    updated_at DATETIME,
    last_sync DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- Table des lignes de devis
CREATE TABLE IF NOT EXISTS quote_lines (
    id INTEGER PRIMARY KEY,
    quote_id INTEGER NOT NULL,
    product_id INTEGER,
    description TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    vat_rate REAL DEFAULT 0,
    total_ht REAL NOT NULL,
    total_ttc REAL NOT NULL,
    line_order INTEGER DEFAULT 0,
    created_at DATETIME,
    updated_at DATETIME,
    last_sync DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (quote_id) REFERENCES quotes(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Table des factures
CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY,
    facturation_id INTEGER UNIQUE NOT NULL,
    customer_id INTEGER NOT NULL,
    invoice_number TEXT UNIQUE NOT NULL,
    invoice_ref INTEGER, -- Numéro séquentiel de la facture
    invoice_date DATE NOT NULL,
    due_date DATE,
    payment_mode INTEGER DEFAULT 0,
    payment_date DATE,
    status INTEGER DEFAULT 0, -- 0: Non payé, 1: Payé
    paid_on DATE, -- Date de paiement
    balance REAL DEFAULT 0, -- Solde restant
    total_ht REAL NOT NULL,
    total_ttc REAL NOT NULL,
    vat_amount REAL NOT NULL,
    notes TEXT,
    created_at DATETIME,
    updated_at DATETIME,
    last_sync DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- Table des lignes de facture
CREATE TABLE IF NOT EXISTS invoice_lines (
    id INTEGER PRIMARY KEY,
    invoice_id INTEGER NOT NULL,
    product_id INTEGER,
    description TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    vat_rate REAL DEFAULT 0,
    total_ht REAL NOT NULL,
    total_ttc REAL NOT NULL,
    line_order INTEGER DEFAULT 0,
    created_at DATETIME,
    updated_at DATETIME,
    last_sync DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Table des paiements
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY,
    invoice_id INTEGER NOT NULL,
    payment_date DATE NOT NULL,
    amount_ht REAL NOT NULL,
    amount_ttc REAL NOT NULL,
    amount_vat REAL NOT NULL,
    payment_mode INTEGER,
    note TEXT,
    source TEXT DEFAULT 'derived', -- 'api' ou 'derived'
    created_at DATETIME,
    updated_at DATETIME,
    last_sync DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);

-- Table de métadonnées de synchronisation
CREATE TABLE IF NOT EXISTS sync_metadata (
    id INTEGER PRIMARY KEY,
    table_name TEXT UNIQUE NOT NULL,
    last_sync DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_page INTEGER DEFAULT 0,
    total_records INTEGER DEFAULT 0
);

-- Index pour améliorer les performances de recherche
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_quotes_customer ON quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_date ON quotes(quote_date);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_quote_lines_quote ON quote_lines(quote_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
