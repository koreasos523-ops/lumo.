const express = require('express');
const { createClient } = require('@libsql/client');
const bcrypt = require('bcrypt');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Turso Cloud Database კავშირი
const db = createClient({
    url: process.env.TURSO_DATABASE_URL || 'file:local.db',
    authToken: process.env.TURSO_AUTH_TOKEN || '',
});

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

// ცხრილების შექმნა და საწყისი მონაცემების (Seed Data) ჩაყრა
async function initDB() {
    try {
        await db.execute(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            email TEXT UNIQUE,
            phone TEXT UNIQUE,
            password TEXT,
            role TEXT DEFAULT 'user'
        )`);

        await db.execute(`CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            price REAL,
            category TEXT,
            image TEXT,
            description TEXT,
            stock INTEGER DEFAULT 10
        )`);

        await db.execute(`CREATE TABLE IF NOT EXISTS product_variants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            productId INTEGER,
            variantName TEXT,
            priceAdjustment REAL DEFAULT 0,
            stock INTEGER DEFAULT 10,
            FOREIGN KEY(productId) REFERENCES products(id) ON DELETE CASCADE
        )`);

        await db.execute(`CREATE TABLE IF NOT EXISTS coupons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE,
            discountPercent INTEGER,
            active INTEGER DEFAULT 1
        )`);

        await db.execute(`CREATE TABLE IF NOT EXISTS orders (
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

        await db.execute(`CREATE TABLE IF NOT EXISTS wishlist (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER,
            productId INTEGER
        )`);

        await db.execute(`CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            productId INTEGER,
            userId INTEGER,
            username TEXT,
            rating INTEGER,
            comment TEXT,
            date TEXT
        )`);

        const prodCount = await db.execute("SELECT COUNT(*) as count FROM products");
        if (prodCount.rows[0].count === 0) {
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

            for (const p of initialProducts) {
                const res = await db.execute({
                    sql: `INSERT INTO products (title, price, category, image, description, stock) VALUES (?, ?, ?, ?, ?, ?)`,
                    args: [p.title, p.price, p.category, p.image, p.description, 10]
                });
                const prodId = Number(res.lastInsertRowid);

                if (p.variants) {
                    for (const v of p.variants) {
                        await db.execute({
                            sql: `INSERT INTO product_variants (productId, variantName, priceAdjustment, stock) VALUES (?, ?, ?, ?)`,
                            args: [prodId, v.name, v.price, v.stock]
                        });
                    }
                }
            }

            await db.execute({
                sql: `INSERT OR IGNORE INTO coupons (code, discountPercent) VALUES (?, ?)`,
                args: ['WOOD2026', 15]
            });
            console.log('საწყისი პროდუქტები წარმატებით ჩაიტვირთა Turso-ში!');
        }
        console.log('Turso ბაზა წარმატებით მუშაობს!');
    } catch (err) {
        console.error('ბაზის ინიციალიზაციის შეცდომა:', err);
    }
}
initDB();

// API: პროდუქტები
app.get('/api/products', async (req, res) => {
    try {
        const prodResult = await db.execute(`
            SELECT products.*, 
            COALESCE(AVG(reviews.rating), 0) as avgRating, 
            COUNT(reviews.id) as reviewCount
            FROM products 
            LEFT JOIN reviews ON products.id = reviews.productId
            GROUP BY products.id
        `);

        const varResult = await db.execute(`SELECT * FROM product_variants`);

        const result = prodResult.rows.map(p => ({
            ...p,
            variants: varResult.rows.filter(v => v.productId === p.id)
        }));
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: პროდუქტის დამატება
app.post('/api/products', upload.single('imageFile'), async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'არ გაქვთ ადმინის უფლება' });
    }

    const { title, price, category, description, stock, variants } = req.body;
    let imageUrl = req.file ? `/uploads/${req.file.filename}` : 'https://via.placeholder.com/400';

    try {
        const insertRes = await db.execute({
            sql: `INSERT INTO products (title, price, category, image, description, stock) VALUES (?, ?, ?, ?, ?, ?)`,
            args: [title, parseFloat(price), category, imageUrl, description, parseInt(stock) || 10]
        });
        const prodId = Number(insertRes.lastInsertRowid);

        if (variants) {
            try {
                const parsedVariants = JSON.parse(variants);
                for (const v of parsedVariants) {
                    await db.execute({
                        sql: `INSERT INTO product_variants (productId, variantName, priceAdjustment, stock) VALUES (?, ?, ?, ?)`,
                        args: [prodId, v.name, parseFloat(v.priceAdjustment) || 0, parseInt(v.stock) || 10]
                    });
                }
            } catch (e) {}
        }
        res.json({ success: true, id: prodId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: პროდუქტის რედაქტირება
app.put('/api/products/:id', upload.single('imageFile'), async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'არ გაქვთ ადმინის უფლება' });
    }

    const prodId = req.params.id;
    const { title, price, category, description, stock, variants } = req.body;

    try {
        if (req.file) {
            await db.execute({
                sql: `UPDATE products SET title = ?, price = ?, category = ?, image = ?, description = ?, stock = ? WHERE id = ?`,
                args: [title, parseFloat(price), category, `/uploads/${req.file.filename}`, description, parseInt(stock), prodId]
            });
        } else {
            await db.execute({
                sql: `UPDATE products SET title = ?, price = ?, category = ?, description = ?, stock = ? WHERE id = ?`,
                args: [title, parseFloat(price), category, description, parseInt(stock), prodId]
            });
        }

        await db.execute({ sql: `DELETE FROM product_variants WHERE productId = ?`, args: [prodId] });

        if (variants) {
            try {
                const parsedVariants = JSON.parse(variants);
                for (const v of parsedVariants) {
                    await db.execute({
                        sql: `INSERT INTO product_variants (productId, variantName, priceAdjustment, stock) VALUES (?, ?, ?, ?)`,
                        args: [prodId, v.name, parseFloat(v.priceAdjustment) || 0, parseInt(v.stock) || 10]
                    });
                }
            } catch (e) {}
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: პროდუქტის წაშლა
app.delete('/api/products/:id', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'უფლება არ გაქვთ' });
    }
    try {
        const id = req.params.id;
        await db.execute({ sql: "DELETE FROM products WHERE id = ?", args: [id] });
        await db.execute({ sql: "DELETE FROM wishlist WHERE productId = ?", args: [id] });
        await db.execute({ sql: "DELETE FROM reviews WHERE productId = ?", args: [id] });
        await db.execute({ sql: "DELETE FROM product_variants WHERE productId = ?", args: [id] });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// კუპონები
app.get('/api/admin/coupons', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'უფლება არ გაქვთ' });
    const r = await db.execute("SELECT * FROM coupons");
    res.json(r.rows);
});

app.post('/api/admin/coupons', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'უფლება არ გაქვთ' });
    const { code, discountPercent } = req.body;
    try {
        await db.execute({
            sql: "INSERT INTO coupons (code, discountPercent) VALUES (?, ?)",
            args: [code.toUpperCase(), parseInt(discountPercent)]
        });
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: 'კოდი უკვე არსებობს ან არასწორია' });
    }
});

app.delete('/api/admin/coupons/:id', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'უფლება არ გაქვთ' });
    await db.execute({ sql: "DELETE FROM coupons WHERE id = ?", args: [req.params.id] });
    res.json({ success: true });
});

app.post('/api/apply-coupon', async (req, res) => {
    const { code } = req.body;
    const r = await db.execute({
        sql: "SELECT * FROM coupons WHERE code = ? AND active = 1",
        args: [code ? code.toUpperCase() : '']
    });
    if (r.rows.length === 0) return res.status(400).json({ error: 'არასწორი ან გაუქმებული პრომო-კოდი!' });
    res.json({ success: true, discountPercent: r.rows[0].discountPercent, code: r.rows[0].code });
});

// ფავორიტები
app.get('/api/wishlist', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'გაიარეთ ავტორიზაცია' });
    const r = await db.execute({ sql: "SELECT productId FROM wishlist WHERE userId = ?", args: [req.session.user.id] });
    res.json(r.rows.map(r => r.productId));
});

app.post('/api/wishlist', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'გაიარეთ ავტორიზაცია' });
    const { productId } = req.body;
    const check = await db.execute({
        sql: "SELECT * FROM wishlist WHERE userId = ? AND productId = ?",
        args: [req.session.user.id, productId]
    });
    if (check.rows.length > 0) {
        await db.execute({
            sql: "DELETE FROM wishlist WHERE userId = ? AND productId = ?",
            args: [req.session.user.id, productId]
        });
        res.json({ status: 'removed' });
    } else {
        await db.execute({
            sql: "INSERT INTO wishlist (userId, productId) VALUES (?, ?)",
            args: [req.session.user.id, productId]
        });
        res.json({ status: 'added' });
    }
});

// მიმოხილვები
app.get('/api/reviews/:productId', async (req, res) => {
    const r = await db.execute({
        sql: "SELECT * FROM reviews WHERE productId = ? ORDER BY id DESC",
        args: [req.params.productId]
    });
    res.json(r.rows);
});

app.post('/api/reviews', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'გაიარეთ ავტორიზაცია' });
    const { productId, rating, comment } = req.body;
    const date = new Date().toLocaleDateString();
    await db.execute({
        sql: "INSERT INTO reviews (productId, userId, username, rating, comment, date) VALUES (?, ?, ?, ?, ?, ?)",
        args: [productId, req.session.user.id, req.session.user.username, parseInt(rating), comment, date]
    });
    res.json({ success: true });
});

// შეკვეთები
app.post('/api/orders', async (req, res) => {
    const { name, phone, address, items, subtotal, discount, total, couponCode } = req.body;
    const userId = req.session.user ? req.session.user.id : null;
    const date = new Date().toLocaleString();

    const r = await db.execute({
        sql: `INSERT INTO orders (userId, name, phone, address, items, subtotal, discount, total, couponCode, status, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'მუშავდება', ?)`,
        args: [userId, name, phone, address, JSON.stringify(items), parseFloat(subtotal), parseFloat(discount) || 0, parseFloat(total), couponCode || '', date]
    });
    res.json({ success: true, id: Number(r.lastInsertRowid) });
});

app.get('/api/orders', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'გაიარეთ ავტორიზაცია' });
    if (req.session.user.role === 'admin') {
        const r = await db.execute("SELECT * FROM orders ORDER BY id DESC");
        res.json(r.rows);
    } else {
        const r = await db.execute({ sql: "SELECT * FROM orders WHERE userId = ? ORDER BY id DESC", args: [req.session.user.id] });
        res.json(r.rows);
    }
});

app.put('/api/orders/:id/status', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'უფლება არ გაქვთ' });
    await db.execute({
        sql: "UPDATE orders SET status = ? WHERE id = ?",
        args: [req.body.status, req.params.id]
    });
    res.json({ success: true });
});

app.get('/api/admin/stats', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'უფლება არ გაქვთ' });
    const orderStats = await db.execute("SELECT COUNT(*) as totalOrders, SUM(total) as totalRevenue FROM orders");
    const prodStats = await db.execute("SELECT COUNT(*) as totalProducts FROM products");
    res.json({
        totalOrders: orderStats.rows[0].totalOrders || 0,
        totalRevenue: orderStats.rows[0].totalRevenue || 0,
        totalProducts: prodStats.rows[0].totalProducts || 0
    });
});

// რეგისტრაცია და ავტორიზაცია
app.post('/api/register', async (req, res) => {
    const { username, email, phone, password } = req.body;
    if (!username || !email || !phone || !password) return res.status(400).json({ error: 'გთხოვთ შეავსოთ ყველა ველი!' });
    if (password.length < 6) return res.status(400).json({ error: 'პაროლი უნდა იყოს მინიმუმ 6 სიმბოლოიანი!' });

    const existing = await db.execute({
        sql: "SELECT * FROM users WHERE username = ? OR email = ? OR phone = ?",
        args: [username, email, phone]
    });

    if (existing.rows.length > 0) {
        const u = existing.rows[0];
        if (u.username === username) return res.status(400).json({ error: 'მომხმარებლის სახელი დაკავებულია!' });
        if (u.email === email) return res.status(400).json({ error: 'ეს ელ-ფოსტა უკვე გამოყენებულია!' });
        if (u.phone === phone) return res.status(400).json({ error: 'ეს ტელეფონის ნომერი უკვე გამოყენებულია!' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const userCount = await db.execute("SELECT COUNT(*) as count FROM users");
        const role = (userCount.rows[0].count === 0) ? 'admin' : 'user';

        await db.execute({
            sql: "INSERT INTO users (username, email, phone, password, role) VALUES (?, ?, ?, ?, ?)",
            args: [username, email, phone, hashedPassword, role]
        });
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'სერვერის შეცდომა' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const r = await db.execute({
        sql: "SELECT * FROM users WHERE username = ? OR email = ?",
        args: [username, username]
    });

    if (r.rows.length === 0) return res.status(400).json({ error: 'არასწორი მონაცემები' });
    const user = r.rows[0];

    const match = await bcrypt.compare(password, user.password);
    if (match) {
        req.session.user = { id: user.id, username: user.username, role: user.role };
        res.json({ success: true, user: req.session.user });
    } else {
        res.status(400).json({ error: 'არასწორი მონაცემები' });
    }
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
