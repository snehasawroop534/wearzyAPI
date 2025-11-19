const mysql = require("mysql2");

// Normal createConnection (same as your code)
const connection = mysql.createConnection({
    host: "localhost",
    database: "wearzy_database",
    password: "",
    user: "root"
});

// Connect as usual
connection.connect(error => {
    if (error) {
        console.log("Database connection error " + error);
    } else {
        console.log("Database connected");
    }
});

// ⬇️ Add promise wrapper here (IMPORTANT)
const db = connection.promise();

module.exports = db;
