const express = require("express");
const db = require("./db")
const multer = require("multer");
const path = require("path");
const { error } = require("console");
const app = express();

app.use(express.urlencoded({ extended: true }));  
app.use(express.json());


const storage = multer.diskStorage({
    destination: "./productImages",
    filename: (request, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

app.use("/productImages", express.static("productImages"));



app.post("/api/products/add", upload.single("productimg"), async (request, response) => {

    if (!request.file) {
        return response.status(400).json({
            message: "Please upload product image"
        });
    }

    const title = request.body.title;
    const brand = request.body.brand;
    const mrp = request.body.mrp;
    const discountedPrice = request.body.discountedPrice;
    const description = request.body.description;
    const filename = request.file.filename || "";

    try{

        db.query(
        `INSERT INTO products 
        (title, brand, mrp, discountedPrice, description, image)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            title,
            brand,
            mrp,
            discountedPrice,
            description,
            filename
        ],
        (error, result) => {

            if (error) {
                console.log("SQL Error:", error);
                return response.status(500).json({ message: "Server internal error" });
            }

            return response.status(201).json({
                message: "Product added successfully",
                product: {
                    id: result.insertId,
                    productId: productId,
                    title: title,
                    brand: brand,
                    mrp: mrp,
                    discountedPrice: discountedPrice,
                    description: description,
                    filename: filename
                }
            });
        }
    );

    }catch(error){

        console.log(error);
        response.json({message: error});

    }

    

    
});

const data=[];

app.post("/test/post",(req, res)=>{

    const name= req.body.name;
    const email= req.body.email;

    res.status(201).json({name: name, email:email});


});




app.get("/api/products", async (request, response) => {
    try {
        const [result] = await db.query("SELECT * FROM products");
        response.status(200).json(result);
    } catch (error) {
        console.error("Error fetching products:", error);
        response.status(500).json({ message: "Server internal error" });
    }
});

app.listen(4005, (error)=>{
    if(error) console.log("Error "+ error);
    console.log("Server is running on port 4005");
})



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


