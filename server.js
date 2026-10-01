const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        cb(null, `img-${Date.now()}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage: storage });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'wood-store-secret-key-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) console.error('ბაზის შეცდომა:', err.message);
    else console.log('ბაზა წარმატებით მუშაობს!');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        email TEXT UNIQUE,
        phone TEXT UNIQUE,
        password TEXT,
        role TEXT DEFAULT 'user'
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        price REAL,
        category TEXT,
        image TEXT,
        description TEXT,
        stock INTEGER DEFAULT 10
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS product_variants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        productId INTEGER,
        variantName TEXT,
        priceAdjustment REAL DEFAULT 0,
        stock INTEGER DEFAULT 10,
        FOREIGN KEY(productId) REFERENCES products(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS coupons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE,
        discountPercent INTEGER,
        active INTEGER DEFAULT 1
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER,
        name TEXT,
        phone TEXT,
        address TEXT,
        items TEXT,
        subtotal REAL,
        discount REAL DEFAULT 0,
        total REAL,
        couponCode TEXT,
        status TEXT DEFAULT 'მუშავდება',
        date TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS wishlist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER,
        productId INTEGER
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        productId INTEGER,
        userId INTEGER,
        username TEXT,
        rating INTEGER,
        comment TEXT,
        date TEXT
    )`, () => {
        // საწყისი პროდუქტების ჩაყრა თუ ბაზა ცარიელია
        db.get("SELECT COUNT(*) as count FROM products", [], (err, row) => {
            if (row && row.count === 0) {
                console.log('ბაზა ცარიელია — ვამატებთ საწყის პროდუქტებს...');
                
                const initialProducts = [
                    {
                        title: 'მანდალის ფორმის კედლის საათი',
                        price: 120,
                        category: 'საათები',
                        image: 'https://images.unsplash.com/photo-1563861826100-9cb868fdbe1c?auto=format&fit=crop&q=80&w=600',
                        description: 'ხელნაკეთი, ლაზერით გამოჭრილი ეგზოტიკური მანდალის დიზაინის კედლის საათი.',
                        variants: [{ name: 'საშუალო (40სმ)', price: 0, stock: 5 }, { name: 'დიდი (60სმ)', price: 40, stock: 3 }]
                    },
                    {
                        title: 'რომანტიკული ღამის სანათი',
                        price: 85,
                        category: 'სანათები',
                        image: 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&q=80&w=600',
                        description: 'თბილი განათების მქონე ხის დიზაინერული სანათი საძინებლისთვის.',
                        variants: [{ name: 'თბილი შუქი', price: 0, stock: 10 }, { name: 'RGB ფერადი', price: 15, stock: 7 }]
                    },
                    {
                        title: 'ფანერის ელეგანტური სასაჩუქრე ყუთი',
                        price: 45,
                        category: 'ყუთები',
                        image: 'https://images.unsplash.com/photo-1513201099705-a9746e1e201f?auto=format&fit=crop&q=80&w=600',
                        description: 'უნივერსალური სასაჩუქრე ყუთი გრავირების შესაძლებლობით.',
                        variants: [{ name: 'სტანდარტული', price: 0, stock: 15 }]
                    },
                    {
                        title: 'გულის ფორმის ფოტოჩარჩო',
                        price: 60,
                        category: 'აქსესუარები',
                        image: 'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?auto=format&fit=crop&q=80&w=600',
                        description: 'ორიგინალური ხის ფოტოჩარჩო თქვენი საყვარელი მომენტებისთვის.',
                        variants: [{ name: 'კლასიკური', price: 0, stock: 8 }]
                    }
                ];

                initialProducts.forEach(p => {
                    db.run(`INSERT INTO products (title, price, category, image, description, stock) VALUES (?, ?, ?, ?, ?, ?)`,
                        [p.title, p.price, p.category, p.image, p.description, 10], function(err) {
                            if (!err && p.variants) {
                                const prodId = this.lastID;
                                p.variants.forEach(v => {
                                    db.run(`INSERT INTO product_variants (productId, variantName, priceAdjustment, stock) VALUES (?, ?, ?, ?)`,
                                        [prodId, v.name, v.price, v.stock]);
                                });
                            }
                        }
                    );
                });

                db.run(`INSERT OR IGNORE INTO coupons (code, discountPercent) VALUES ('WOOD2026', 15)`);
                console.log('საწყისი პროდუქტები წარმატებით ჩაიტვირთა!');
            }
        });
    });
});

app.get('/api/products', (req, res) => {
    db.all(`SELECT products.*, 
            COALESCE(AVG(reviews.rating), 0) as avgRating, 
            COUNT(reviews.id) as reviewCount
            FROM products 
            LEFT JOIN reviews ON products.id = reviews.productId
            GROUP BY products.id`, [], (err, products) => {
        if (err) return res.status(500).json({ error: err.message });

        db.all(`SELECT * FROM product_variants`, [], (err, variants) => {
            if (err) return res.status(500).json({ error: err.message });

            const result = products.map(p => ({
                ...p,
                variants: variants.filter(v => v.productId === p.id)
            }));
            res.json(result);
        });
    });
});

app.post('/api/products', upload.single('imageFile'), (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'არ გაქვთ ადმინის უფლება' });
    }

    const { title, price, category, description, stock, variants } = req.body;
    let imageUrl = req.file ? `/uploads/${req.file.filename}` : 'https://via.placeholder.com/400';

    db.run(`INSERT INTO products (title, price, category, image, description, stock) VALUES (?, ?, ?, ?, ?, ?)`,
        [title, parseFloat(price), category, imageUrl, description, parseInt(stock) || 10],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            const prodId = this.lastID;

            if (variants) {
                try {
                    const parsedVariants = JSON.parse(variants);
                    const stmt = db.prepare(`INSERT INTO product_variants (productId, variantName, priceAdjustment, stock) VALUES (?, ?, ?, ?)`);
                    parsedVariants.forEach(v => {
                        stmt.run(prodId, v.name, parseFloat(v.priceAdjustment) || 0, parseInt(v.stock) || 10);
                    });
                    stmt.finalize();
                } catch(e) {}
            }
            res.json({ success: true, id: prodId });
        }
    );
});

app.put('/api/products/:id', upload.single('imageFile'), (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'არ გაქვთ ადმინის უფლება' });
    }

    const prodId = req.params.id;
    const { title, price, category, description, stock, variants } = req.body;

    const updateQuery = req.file 
        ? `UPDATE products SET title = ?, price = ?, category = ?, image = ?, description = ?, stock = ? WHERE id = ?`
        : `UPDATE products SET title = ?, price = ?, category = ?, description = ?, stock = ? WHERE id = ?`;
    
    const params = req.file 
        ? [title, parseFloat(price), category, `/uploads/${req.file.filename}`, description, parseInt(stock), prodId]
        : [title, parseFloat(price), category, description, parseInt(stock), prodId];

    db.run(updateQuery, params, function(err) {
        if (err) return res.status(500).json({ error: err.message });

        db.run(`DELETE FROM product_variants WHERE productId = ?`, [prodId], () => {
            if (variants) {
                try {
                    const parsedVariants = JSON.parse(variants);
                    const stmt = db.prepare(`INSERT INTO product_variants (productId, variantName, priceAdjustment, stock) VALUES (?, ?, ?, ?)`);
                    parsedVariants.forEach(v => {
                        stmt.run(prodId, v.name, parseFloat(v.priceAdjustment) || 0, parseInt(v.stock) || 10);
                    });
                    stmt.finalize();
                } catch(e) {}
            }
            res.json({ success: true });
        });
    });
});

app.delete('/api/products/:id', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'უფლება არ გაქვთ' });
    }
    db.run("DELETE FROM products WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        db.run("DELETE FROM wishlist WHERE productId = ?", [req.params.id]);
        db.run("DELETE FROM reviews WHERE productId = ?", [req.params.id]);
        db.run("DELETE FROM product_variants WHERE productId = ?", [req.params.id]);
        res.json({ success: true });
    });
});

app.get('/api/admin/coupons', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'უფლება არ გაქვთ' });
    db.all("SELECT * FROM coupons", [], (err, rows) => res.json(rows));
});

app.post('/api/admin/coupons', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'უფლება არ გაქვთ' });
    const { code, discountPercent } = req.body;
    db.run("INSERT INTO coupons (code, discountPercent) VALUES (?, ?)", [code.toUpperCase(), parseInt(discountPercent)], function(err) {
        if (err) return res.status(400).json({ error: 'კოდი უკვე არსებობს ან არასწორია' });
        res.json({ success: true });
    });
});

app.delete('/api/admin/coupons/:id', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'უფლება არ გაქვთ' });
    db.run("DELETE FROM coupons WHERE id = ?", [req.params.id], () => res.json({ success: true }));
});

app.post('/api/apply-coupon', (req, res) => {
    const { code } = req.body;
    db.get("SELECT * FROM coupons WHERE code = ? AND active = 1", [code ? code.toUpperCase() : ''], (err, coupon) => {
        if (!coupon) return res.status(400).json({ error: 'არასწორი ან გაუქმებული პრომო-კოდი!' });
        res.json({ success: true, discountPercent: coupon.discountPercent, code: coupon.code });
    });
});

app.get('/api/wishlist', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'გაიარეთ ავტორიზაცია' });
    db.all("SELECT productId FROM wishlist WHERE userId = ?", [req.session.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(r => r.productId));
    });
});

app.post('/api/wishlist', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'გაიარეთ ავტორიზაცია' });
    const { productId } = req.body;
    db.get("SELECT * FROM wishlist WHERE userId = ? AND productId = ?", [req.session.user.id, productId], (err, row) => {
        if (row) {
            db.run("DELETE FROM wishlist WHERE userId = ? AND productId = ?", [req.session.user.id, productId], () => {
                res.json({ status: 'removed' });
            });
        } else {
            db.run("INSERT INTO wishlist (userId, productId) VALUES (?, ?)", [req.session.user.id, productId], () => {
                res.json({ status: 'added' });
            });
        }
    });
});

app.get('/api/reviews/:productId', (req, res) => {
    db.all("SELECT * FROM reviews WHERE productId = ? ORDER BY id DESC", [req.params.productId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/reviews', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'გაიარეთ ავტორიზაცია' });
    const { productId, rating, comment } = req.body;
    const date = new Date().toLocaleDateString();
    db.run("INSERT INTO reviews (productId, userId, username, rating, comment, date) VALUES (?, ?, ?, ?, ?, ?)",
        [productId, req.session.user.id, req.session.user.username, parseInt(rating), comment, date],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

app.post('/api/orders', (req, res) => {
    const { name, phone, address, items, subtotal, discount, total, couponCode } = req.body;
    const userId = req.session.user ? req.session.user.id : null;
    const date = new Date().toLocaleString();

    db.run(`INSERT INTO orders (userId, name, phone, address, items, subtotal, discount, total, couponCode, status, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'მუშავდება', ?)`,
        [userId, name, phone, address, JSON.stringify(items), parseFloat(subtotal), parseFloat(discount) || 0, parseFloat(total), couponCode || '', date],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
        }
    );
});

app.get('/api/orders', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'გაიარეთ ავტორიზაცია' });
    if (req.session.user.role === 'admin') {
        db.all("SELECT * FROM orders ORDER BY id DESC", [], (err, rows) => res.json(rows));
    } else {
        db.all("SELECT * FROM orders WHERE userId = ? ORDER BY id DESC", [req.session.user.id], (err, rows) => res.json(rows));
    }
});

app.put('/api/orders/:id/status', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'უფლება არ გაქვთ' });
    db.run("UPDATE orders SET status = ? WHERE id = ?", [req.body.status, req.params.id], () => res.json({ success: true }));
});

app.get('/api/admin/stats', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'უფლება არ გაქვთ' });
    db.get("SELECT COUNT(*) as totalOrders, SUM(total) as totalRevenue FROM orders", [], (err, orderStats) => {
        db.get("SELECT COUNT(*) as totalProducts FROM products", [], (err2, prodStats) => {
            res.json({
                totalOrders: orderStats.totalOrders || 0,
                totalRevenue: orderStats.totalRevenue || 0,
                totalProducts: prodStats.totalProducts || 0
            });
        });
    });
});

app.post('/api/register', async (req, res) => {
    const { username, email, phone, password } = req.body;
    if (!username || !email || !phone || !password) return res.status(400).json({ error: 'გთხოვთ შეავსოთ ყველა ველი!' });
    if (password.length < 6) return res.status(400).json({ error: 'პაროლი უნდა იყოს მინიმუმ 6 სიმბოლოიანი!' });

    db.get("SELECT * FROM users WHERE username = ? OR email = ? OR phone = ?", [username, email, phone], async (err, existingUser) => {
        if (existingUser) {
            if (existingUser.username === username) return res.status(400).json({ error: 'მომხმარებლის სახელი დაკავებულია!' });
            if (existingUser.email === email) return res.status(400).json({ error: 'ეს ელ-ფოსტა უკვე გამოყენებულია!' });
            if (existingUser.phone === phone) return res.status(400).json({ error: 'ეს ტელეფონის ნომერი უკვე გამოყენებულია!' });
        }

        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            db.get("SELECT COUNT(*) as count FROM users", [], (err, row) => {
                const role = (row.count === 0) ? 'admin' : 'user';
                db.run("INSERT INTO users (username, email, phone, password, role) VALUES (?, ?, ?, ?, ?)", 
                    [username, email, phone, hashedPassword, role], (err) => {
                    if (err) return res.status(500).json({ error: 'ბაზის შეცდომა' });
                    res.json({ success: true });
                });
            });
        } catch { res.status(500).json({ error: 'სერვერის შეცდომა' }); }
    });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ? OR email = ?", [username, username], async (err, user) => {
        if (err || !user) return res.status(400).json({ error: 'არასწორი მონაცემები' });
        const match = await bcrypt.compare(password, user.password);
        if (match) {
            req.session.user = { id: user.id, username: user.username, role: user.role };
            res.json({ success: true, user: req.session.user });
        } else {
            res.status(400).json({ error: 'არასწორი მონაცემები' });
        }
    });
});

app.get('/api/check-auth', (req, res) => {
    if (req.session.user) res.json({ loggedIn: true, user: req.session.user });
    else res.json({ loggedIn: false });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.listen(PORT, () => console.log(`სერვერი წარმატებით მუშაობს პორტზე: ${PORT}`));