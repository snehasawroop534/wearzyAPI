const express = require("express");
const db = require("./db")
const jwt = require("jsonwebtoken");
const multer = require("multer");
const bcrypt = require("bcrypt");
const path = require("path");
const { error } = require("console");
const crypto = require("crypto");
const app = express();

const Razorpay = require("razorpay");

const razorpay = new Razorpay({
    key_id: "YOUR_RAZORPAY_KEY",
    key_secret: "YOUR_RAZORPAY_SECRET"
});


app.use(express.urlencoded({ extended: true }));  
app.use(express.json());


const storage = multer.diskStorage({
    destination:"./productImages",
    filename:(request, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

app.use("/productImages", express.static("productImages"));

// Post product for admin use

app.post("/api/products/add", upload.single("productimg"), async (req, res) => {

    if (!req.file) {
        return res.status(400).json({ message: "Please upload product image" });
    }

    const { title, brand, mrp, discountedPrice, description } = req.body;
    const filename = req.file.filename;

    try {
        const [result] = await db.query(
            `INSERT INTO products 
            (title, brand, mrp, discountedPrice, description, image)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [title, brand, mrp, discountedPrice, description, filename]
        );

        res.status(201).json({
            message: "Product added successfully",
            product: {
                productId: result.insertId,
                title,
                brand,
                mrp,
                discountedPrice,
                description,
                image: filename
            }
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Server internal error"+ error });
    }
});


// get all products

app.get("/api/products", async (request, response) => {
    try {
        const [result] = await db.query("SELECT * FROM products");
        response.status(200).json(result);
    } catch (error) {
        console.error("Error fetching products:", error);
        response.status(500).json({ message: "Server internal error" });
    }
});

// get all products by id 

app.get("/api/products/:id", async (request, response) => {
    const productId = request.params.id;

    try {
        const [result] = await db.query(
            "SELECT * FROM products WHERE productId = ?",
            [productId]
        );

        if (result.length === 0) {
            return response.status(404).json({ message: "Product not found" });
        }

        response.status(200).json(result[0]);
    } catch (error) {
        console.error("Error fetching product:", error);
        response.status(500).json({ message: "Server internal error" });
    }
});

// search products

app.get("/api/products/search/st", async (request, response) => {
    const searchQuery = request.query.q;

    try {
        // validation
        if (!searchQuery || searchQuery.trim() === "") {
            return response.status(400).json({
                message: "Search query (q) is required",
            });
        }

        const sql = `
            SELECT * 
            FROM products 
            WHERE title LIKE ? OR brand LIKE ? OR description LIKE ?
        `;

        const likeValue = `%${searchQuery}%`;

        const [result] = await db.query(sql, [
            likeValue,
            likeValue,
            likeValue,
        ]);

        response.status(200).json({
            message: "Search results",
            total: result.length,
            data: result,
        });

    } catch (error) {
        console.error("Error searching products:", error);
        response.status(500).json({
            message: "Internal server error",
        });
    }
});




// get categories 


app.get("/api/categories", async (request, response) => {
    try {
        const [result] = await db.query("SELECT * FROM categories");
        response.status(200).json(result);

    } catch (error) {
        console.error("Error fetching categories:", error);
        response.status(500).json({ message: "Internal server error" });
    }
});



// add category

app.post("/api/categories/add", async (request, response) => {
    const { name, slug } = request.body;

    try {
        const [result] = await db.query(
            "INSERT INTO categories (name, slug) VALUES (?, ?)",
            [name, slug]
        );

        response.status(201).json({
            id: result.insertId,
            name,
            slug
        });

    } catch (error) {
        console.error("Error adding category:", error);
        response.status(500).json({ message: "Internal server error" });
    }
});

// get filters

app.get("/api/filters", async (request, response) => {
    try {
        const [result] = await db.query("SELECT * FROM filters LIMIT 1");

        if (result.length === 0) {
            return response.status(404).json({ message: "No filters found" });
        }

        const filters = result[0];
        filters.brands = JSON.parse(filters.brands);
        filters.colors = JSON.parse(filters.colors);
        filters.sizes = JSON.parse(filters.sizes);
        filters.discounts = JSON.parse(filters.discounts);

        response.status(200).json(filters);

    } catch (error) {
        console.error("Error fetching filters:", error);
        response.status(500).json({ message: "Internal server error" });
    }
});



// Add to cart

app.post("/api/cart/add", async (request, response) => {
    const { userId, productId, size, quantity, price } = request.body;

    try {
        const [result] = await db.query(
            `INSERT INTO cart (userId, productId, size, quantity, price)
             VALUES (?, ?, ?, ?, ?)`,
            [userId, productId, size, quantity, price]
        );

        response.status(201).json({
            message: "Item added to cart",
            cartItemId: result.insertId
        });

    } catch (error) {
        console.error("Error adding to cart:", error);
        response.status(500).json({ message: "Internal server error" });
    }
});

// get  cart 

app.get("/api/cart/:userId", async (request, response) => {
    const userId = request.params.userId;

    try {
        const [result] = await db.query("SELECT * FROM cart WHERE userId = ?", [
            userId,
        ]);

        response.status(200).json(result);

    } catch (error) {
        console.error("Error fetching cart:", error);
        response.status(500).json({ message: "Internal server error" });
    }
});

// update quantity

app.put("/api/cart/update/:id", async (request, response) => {
    const cartId = request.params.id;
    const quantity = request.body.quantity;

    try {
        // Validation
        if (!quantity || quantity <= 0) {
            return response.status(400).json({
                message: "Quantity is required and must be greater than 0",
            });
        }

        const sql = `
            UPDATE cart 
            SET quantity = ?
            WHERE id = ?
        `;

        const [result] = await db.query(sql, [quantity, cartId]);

        // If cart item not found
        if (result.affectedRows === 0) {
            return response.status(404).json({
                message: "Cart item not found",
            });
        }

        response.status(200).json({
            message: "Cart quantity updated successfully",
            cartId: cartId,
            quantity: quantity,
        });

    } catch (error) {
        console.error("Error updating cart quantity:", error);
        response.status(500).json({
            message: "Internal server error",
        });
    }
});


// Remove item

app.delete("/api/cart/:id", async (request, response) => {
    const cartId = request.params.id;

    try {
        // Validation
        if (!cartId) {
            return response.status(400).json({
                message: "Cart ID is required",
            });
        }

        const sql = `
            DELETE FROM cart
            WHERE id = ?
        `;

        const [result] = await db.query(sql, [cartId]);

        // If no item deleted (item not found)
        if (result.affectedRows === 0) {
            return response.status(404).json({
                message: "Cart item not found",
            });
        }

        response.status(200).json({
            message: "Cart item removed successfully",
            cartId: cartId
        });

    } catch (error) {
        console.error("Error deleting cart item:", error);
        response.status(500).json({
            message: "Internal server error",
        });
    }
});

// wishlist api 

// Add to whishlist 

app.post("/api/wishlist/add", async (request, response) => {
    const userId = request.body.userId;
    const productId = request.body.productId;

    try {
        // Validation
        if (!userId || !productId) {
            return response.status(400).json({
                message: "userId and productId are required",
            });
        }

        const sql = `
            INSERT INTO wishlist (userId, productId)
            VALUES (?, ?)
        `;

        const [result] = await db.query(sql, [userId, productId]);

        response.status(200).json({
            message: "Product added to wishlist",
            wishlistId: result.insertId,
            userId,
            productId
        });

    } catch (error) {
        console.error("Error adding wishlist item:", error);
        response.status(500).json({
            message: "Internal server error",
        });
    }
});

// get wishlist

app.get("/api/wishlist/:userId", async (request, response) => {
    const userId = request.params.userId;

    try {
        if (!userId) {
            return response.status(400).json({
                message: "User ID is required",
            });
        }

        const sql = `
            SELECT wishlist.id, products.*
            FROM wishlist
            JOIN products ON wishlist.productId = products.productId
            WHERE wishlist.userId = ?
        `;

        const [result] = await db.query(sql, [userId]);

        response.status(200).json({
            message: "Wishlist fetched successfully",
            total: result.length,
            data: result
        });

    } catch (error) {
        console.error("Error fetching wishlist:", error);
        response.status(500).json({
            message: "Internal server error",
        });
    }
});

// Remove wishlist

app.delete("/api/wishlist/:id", async (request, response) => {
    const wishlistId = request.params.id;

    try {
        if (!wishlistId) {
            return response.status(400).json({
                message: "Wishlist ID is required",
            });
        }

        const sql = `
            DELETE FROM wishlist
            WHERE id = ?
        `;

        const [result] = await db.query(sql, [wishlistId]);

        if (result.affectedRows === 0) {
            return response.status(404).json({
                message: "Wishlist item not found",
            });
        }

        response.status(200).json({
            message: "Wishlist item removed successfully",
            wishlistId: wishlistId,
        });

    } catch (error) {
        console.error("Error deleting wishlist item:", error);
        response.status(500).json({
            message: "Internal server error",
        });
    }
});

// orders

//Place Order

app.post("/api/order/place", async (request, response) => {
    const { userId, items, totalAmount } = request.body;

    try {
        if (!userId || !items || items.length === 0 || !totalAmount) {
            return response.status(400).json({
                message: "userId, items & totalAmount are required",
            });
        }

        // Insert order
        const [orderResult] = await db.query(
            "INSERT INTO orders (userId, totalAmount) VALUES (?, ?)",
            [userId, totalAmount]
        );

        const orderId = orderResult.insertId;

        // Insert order items
        for (let item of items) {
            await db.query(
                "INSERT INTO order_items (orderId, productId, quantity, price) VALUES (?, ?, ?, ?)",
                [orderId, item.productId, item.quantity, item.price]
            );
        }

        response.status(200).json({
            message: "Order placed successfully",
            orderId: orderId,
        });

    } catch (error) {
        console.error("Error placing order:", error);
        response.status(500).json({
            message: "Internal server error",
        });
    }
});

// get user orders

app.get("/api/order/my-orders", async (request, response) => {
    const userId = request.query.userId;

    try {
        if (!userId) {
            return response.status(400).json({
                message: "userId is required",
            });
        }

        const [orders] = await db.query(
            "SELECT * FROM orders WHERE userId = ? ORDER BY createdAt DESC",
            [userId]
        );

        response.status(200).json({
            message: "Orders fetched successfully",
            orders: orders,
        });

    } catch (error) {
        console.error("Error fetching orders:", error);
        response.status(500).json({
            message: "Internal server error",
        });
    }
});

// get order details 

app.get("/api/order/:id", async (request, response) => {
    const orderId = request.params.id;

    try {
        const [[order]] = await db.query(
            "SELECT * FROM orders WHERE id = ?",
            [orderId]
        );

        if (!order) {
            return response.status(404).json({
                message: "Order not found",
            });
        }

        const [items] = await db.query(
            "SELECT * FROM order_items WHERE orderId = ?",
            [orderId]
        );

        response.status(200).json({
            message: "Order details fetched successfully",
            order: order,
            items: items,
        });

    } catch (error) {
        console.error("Error fetching order details:", error);
        response.status(500).json({
            message: "Internal server error",
        });
    }
});

// update order status 

app.put("/api/order/status/:id", async (request, response) => {
    const orderId = request.params.id;
    const status = request.body.status;

    try {
        if (!status) {
            return response.status(400).json({
                message: "Status is required",
            });
        }

        const [result] = await db.query(
            "UPDATE orders SET status=? WHERE id=?",
            [status, orderId]
        );

        if (result.affectedRows === 0) {
            return response.status(404).json({
                message: "Order not found",
            });
        }

        response.status(200).json({
            message: "Order status updated successfully",
            status: status,
        });

    } catch (error) {
        console.error("Error updating order status:", error);
        response.status(500).json({
            message: "Internal server error",
        });
    }
});

// Address Api

// Post Add Address

app.post("/api/address/add", async (request, response) => {
    const {
        userId,
        fullName,
        phone,
        pincode,
        state,
        city,
        houseNo,
        addressType
    } = request.body;

    try {
        if (!userId || !fullName || !phone || !pincode || !state || !city || !houseNo || !addressType) {
            return response.status(400).json({
                message: "All fields are required",
            });
        }

        const [result] = await db.query(
            `INSERT INTO address 
             (userId, fullName, phone, pincode, state, city, houseNo, addressType)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, fullName, phone, pincode, state, city, houseNo, addressType]
        );

        response.status(200).json({
            message: "Address added successfully",
            addressId: result.insertId
        });

    } catch (error) {
        console.error("Error adding address:", error);
        response.status(500).json({
            message: "Internal server error",
        });
    }
});

// Get Addresses

app.get("/api/address", async (request, response) => {
    const userId = request.query.userId;

    try {
        if (!userId) {
            return response.status(400).json({
                message: "UserId is required",
            });
        }

        const [addresses] = await db.query(
            "SELECT * FROM address WHERE userId = ? ORDER BY createdAt DESC",
            [userId]
        );

        response.status(200).json({
            message: "Addresses fetched successfully",
            addresses: addresses
        });

    } catch (error) {
        console.error("Error fetching addresses:", error);
        response.status(500).json({
            message: "Internal server error",
        });
    }
});

// Update Address

app.put("/api/address/:id", async (request, response) => {
    const addressId = request.params.id;

    const {
        fullName,
        phone,
        pincode,
        state,
        city,
        houseNo,
        addressType
    } = request.body;

    try {
        if (!fullName || !phone || !pincode || !state || !city || !houseNo || !addressType) {
            return response.status(400).json({
                message: "All fields are required",
            });
        }

        const [result] = await db.query(
            `UPDATE address SET 
                fullName=?, phone=?, pincode=?,
                state=?, city=?, houseNo=?, addressType=?
             WHERE id=?`,
            [fullName, phone, pincode, state, city, houseNo, addressType, addressId]
        );

        if (result.affectedRows === 0) {
            return response.status(404).json({
                message: "Address not found",
            });
        }

        response.status(200).json({
            message: "Address updated successfully"
        });

    } catch (error) {
        console.error("Error updating address:", error);
        response.status(500).json({
            message: "Internal server error",
        });
    }
});

// Delete Address

app.delete("/api/address/:id", async (request, response) => {
    const addressId = request.params.id;

    try {
        const [result] = await db.query(
            "DELETE FROM address WHERE id=?",
            [addressId]
        );

        if (result.affectedRows === 0) {
            return response.status(404).json({
                message: "Address not found",
            });
        }

        response.status(200).json({
            message: "Address deleted successfully"
        });

    } catch (error) {
        console.error("Error deleting address:", error);
        response.status(500).json({
            message: "Internal server error",
        });
    }
});


// Payment Apis




// Create Payment order (POST)

app.post("/api/payment/create", async (request, response) => {
    const { userId, amount } = request.body;

    try {
        if (!userId || !amount) {
            return response.status(400).json({
                message: "UserId and Amount are required",
            });
        }

        const options = {
            amount: amount * 100,  // convert to paise
            currency: "INR",
            receipt: "order_rcpt_" + Date.now(),
        };

        const order = await razorpay.orders.create(options);

        await db.query(
            "INSERT INTO payments (userId, orderId, amount, currency) VALUES (?, ?, ?, ?)",
            [userId, order.id, amount, "INR"]
        );

        response.status(200).json({
            message: "Payment order created successfully",
            orderId: order.id,
            amount: amount,
        });

    } catch (error) {
        console.error("Error creating payment order:", error);
        response.status(500).json({
            message: "Internal server error",
        });
    }
});



// Payment Callback (POST)

// const crypto = require("crypto");

app.post("/api/payment/verify", async (request, response) => {
    const {
        orderId,
        paymentId,
        signature,
        userId
    } = request.body;

    try {
        if (!orderId || !paymentId || !signature || !userId) {
            return response.status(400).json({
                message: "All fields are required",
            });
        }

        const generatedSignature = crypto
            .createHmac("sha256", "YOUR_RAZORPAY_SECRET")
            .update(orderId + "|" + paymentId)
            .digest("hex");

        if (generatedSignature !== signature) {
            return response.status(400).json({
                message: "Payment verification failed",
            });
        }

        const [result] = await db.query(
            "UPDATE payments SET paymentId=?, signature=?, status=? WHERE orderId=? AND userId=?",
            [paymentId, signature, "SUCCESS", orderId, userId]
        );

        if (result.affectedRows === 0) {
            return response.status(404).json({
                message: "Payment record not found",
            });
        }

        response.status(200).json({
            message: "Payment verified successfully",
            paymentId: paymentId,
        });

    } catch (error) {
        console.error("Error verifying payment:", error);
        response.status(500).json({
            message: "Internal server error",
        });
    }
});





// user register

app.post("/api/user/register", async (request, response) => {
    const name = request.body.name;
    const email = request.body.email;
    const password = request.body.password;

    try {
        const passwordHash = await bcrypt.hash(password, 10);

        const [result] = await db.query(
            "INSERT INTO users(name, email, password) VALUES (?, ?, ?)",
            [name, email, passwordHash]
        );

        response.status(201).json({
            Message: "Register successfully",
            user: {
            name: name,
            email: email
            }
        });

    } catch (error) {
        console.error("Database INSERT error:", error);

        if (error.errno === 1062) {
            return response.status(409).json({
                message: "This email address is already registered."
            });
        }

        return response.status(500).json({
            message: "Server internal error. Could not register user."
        });
    }
});


// user login

app.post("/api/user/login", async (request, response) => {
    const email = request.body.email;
    const password = request.body.password;

    const ACCESS_SECRET = "ACCESS_SECRET_KEY";
    const REFRESH_SECRET = "REFRESH_SECRET_KEY";

    try {
        const [result] = await db.query(
            "SELECT userId, name, email, password FROM users WHERE email=?",
            [email]
        );

        if (result.length === 0) {
            return response.status(401).json({
                message: "Invalid email or password"
            });
        }

        const user = result[0];
        const isPasswordSame = await bcrypt.compare(password, user.password);

        if (!isPasswordSame) {
            return response.status(401).json({
                message: "Invalid email or password"
            });
        }

        // Generate Access Token
        const accessToken = jwt.sign(
            { userId: user.userId, email: user.email },
            ACCESS_SECRET,
            { expiresIn: "15m" }
        );

        // Generate Refresh Token
        const refreshToken = jwt.sign(
            { userId: user.userId, email: user.email },
            REFRESH_SECRET,
            { expiresIn: "7d" }
        );

        // Save refresh token in database
        await db.query(
            "INSERT INTO refresh_tokens (userId, token) VALUES (?, ?)",
            [user.userId, refreshToken]
        );

        response.status(200).json({
            message: "Login successful",
            accessToken: accessToken,
            refreshToken: refreshToken
        });

    } catch (error) {
        console.error("Login Error:", error);
        response.status(500).json({ message: "Internal server error" });
    }
});


//refresh token

app.post("/api/auth/refresh-token", async (request, response) => {
    const refreshToken = request.body.refreshToken;

    const ACCESS_SECRET = "ACCESS_SECRET_KEY";
    const REFRESH_SECRET = "REFRESH_SECRET_KEY";

    try {
        // Check token provided or not
        if (!refreshToken) {
            return response.status(400).json({
                message: "Refresh token is required"
            });
        }

        // Check token exists in DB
        const [tokenRecord] = await db.query(
            "SELECT * FROM refresh_tokens WHERE token=?",
            [refreshToken]
        );

        if (tokenRecord.length === 0) {
            return response.status(403).json({
                message: "Invalid refresh token"
            });
        }

        // Verify refresh token
        jwt.verify(refreshToken, REFRESH_SECRET, (err, userData) => {
            if (err) {
                return response.status(403).json({
                    message: "Invalid or expired refresh token"
                });
            }

            // Create new access token
            const newAccessToken = jwt.sign(
                {
                    userId: userData.userId,
                    email: userData.email
                },
                ACCESS_SECRET,
                { expiresIn: "15m" }
            );

            response.status(200).json({
                message: "New access token generated",
                accessToken: newAccessToken
            });
        });

    } catch (error) {
        console.error("Refresh Token Error:", error);
        response.status(500).json({
            message: "Internal server error"
        });
    }
});



//logout api

app.post("/api/auth/logout", async (request, response) => {
    const refreshToken = request.body.refreshToken;

    try {
        if (!refreshToken) {
            return response.status(400).json({
                message: "Refresh token is required"
            });
        }

        await db.query(
            "DELETE FROM refresh_tokens WHERE token=?",
            [refreshToken]
        );

        response.status(200).json({
            message: "Logged out successfully"
        });

    } catch (error) {
        console.error("Logout Error:", error);
        response.status(500).json({
            message: "Internal server error"
        });
    }
});


// get all user 

app.get("/api/user", async (request, response) => {
    try {
        const [result] = await db.query("SELECT * FROM users");
        response.status(200).json(result);
    } catch (error) {
        console.error("Fetch users error:", error);
        response.status(500).json({ message: "Server internal error." });
    }
});


// get single user profile

app.get("/api/user/profile", (request, response) => {

    const token = request.headers.authorization;
    const ACCESS_SECRET = "ACCESS_SECRET_KEY"; // SAME SECRET USED IN LOGIN

    if(!token){
        return response.status(400).json({message: "Token missing"});
    }

    jwt.verify(token, ACCESS_SECRET, (error, result) => {
        if (error) {
            return response.status(401).json({message: "Unauthorized"});
        } else {
            return response.status(200).json({profile: result});
        }
    });

});


// user update pofile 

app.put("/api/user/profile/update/:userId", async (request, response) => {
    const name = request.body.name;
    const email = request.body.email;
    const userId = request.params.userId;

    try {
        if (!name || !email) {
            return response.status(400).json({
                message: "Name and Email are required",
            });
        }

        const [result] = await db.query(
            "UPDATE users SET name=?, email=? WHERE userId=?",
            [name, email, userId]
        );

        if (result.affectedRows === 0) {
            return response.status(404).json({
                message: "User not found",
            });
        }

        response.status(200).json({
            message: "Data updated successfully",
            name: name,
            email: email,
        });

    } catch (error) {
        console.error("Error updating profile:", error);
        response.status(500).json({
            message: "Internal server error",
        });
    }
});


// SEND OTP

// import crypto from "crypto";

app.post("/api/auth/send-otp", async (request, response) => {
    const email = request.body.email;

    try {
        // Validation
        if (!email) {
            return response.status(400).json({
                message: "Email is required",
            });
        }

        // Generate random 6-digit OTP
        const otp = crypto.randomInt(100000, 999999).toString();

        // Save OTP in DB
        await db.query(
            "INSERT INTO password_reset_otps (email, otp) VALUES (?, ?)",
            [email, otp]
        );

        // TODO: Send OTP email (optional, if needed)
        console.log("Generated OTP:", otp);

        // Success Response
        response.status(200).json({
            message: "OTP sent successfully",
            email: email,
            otp: otp, // show in response for testing — remove in production
        });

    } catch (error) {
        console.error("Send OTP Error:", error);
        response.status(500).json({
            message: "Internal server error",
        });
    }
});



// reset password api

app.post("/api/auth/reset-password", async (request, response) => {
    const { email, otp, newPassword } = request.body;

    try {

        // Validation
        if (!email || !otp || !newPassword) {
            return response.status(400).json({
                message: "email, otp & newPassword are required",
            });
        }

        // Check OTP
        const [otpRecord] = await db.query(
            "SELECT * FROM password_reset_otps WHERE email=? AND otp=? ORDER BY createdAt DESC LIMIT 1",
            [email, otp]
        );

        if (otpRecord.length === 0) {
            return response.status(400).json({
                message: "Invalid or expired OTP",
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update user password
        await db.query(
            "UPDATE users SET password=? WHERE email=?",
            [hashedPassword, email]
        );

        // Delete OTP after use
        await db.query(
            "DELETE FROM password_reset_otps WHERE email=?",
            [email]
        );

        // Success Response
        response.status(200).json({
            message: "Password reset successfully",
            email: email,
        });

    } catch (error) {
        console.error("Reset Password Error:", error);
        response.status(500).json({
            message: "Internal server error",
        });
    }
});




app.listen(4006, (error)=>{
    if(error) console.log("Error "+ error);
    console.log("Server is running on port 4006");
})

