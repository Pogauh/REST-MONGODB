const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const { z } = require("zod");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const port = 8000;
const server = http.createServer(app); // ✅ important de le déclarer ici
const io = new Server(server, {
    cors: { origin: "*" },
});

const client = new MongoClient("mongodb://localhost:27017");
let db;

app.use(express.json());
app.use(express.static("public"));


const ProductSchema = z.object({
    _id: z.string(),
    name: z.string(),
    about: z.string(),
    price: z.number().positive(),
    categoryIds: z.array(z.string()),
});

const CreateProductSchema = ProductSchema.omit({ _id: true });

const CategorySchema = z.object({
    _id: z.string(),
    name: z.string(),
});

const CreateCategorySchema = CategorySchema.omit({ _id: true });


app.post("/categories", async (req, res) => {
    const result = await CreateCategorySchema.safeParseAsync(req.body);

    if (!result.success) return res.status(400).json(result.error);

    const { name } = result.data;
    const ack = await db.collection("categories").insertOne({ name });
    res.status(201).json({ _id: ack.insertedId, name });
});


app.post("/products", async (req, res) => {
    const result = await CreateProductSchema.safeParseAsync(req.body);

    if (!result.success) return res.status(400).json(result.error);

    try {
        const { name, about, price, categoryIds } = result.data;
        const categoryObjectIds = categoryIds.map((id) => new ObjectId(id));

        const ack = await db.collection("products").insertOne({
            name,
            about,
            price,
            categoryIds: categoryObjectIds,
        });

        const newProduct = {
            _id: ack.insertedId,
            name,
            about,
            price,
            categoryIds: categoryObjectIds,
        };

        res.status(201).json(newProduct);

        io.emit("products", {
            action: "created",
            product: newProduct,
        });
    } catch (err) {
        res.status(500).json({ error: "Erreur lors de la création", details: err.message });
    }
});

app.get("/products", async (req, res) => {
    try {
        const result = await db
            .collection("products")
            .aggregate([
                { $match: {} },
                {
                    $lookup: {
                        from: "categories",
                        localField: "categoryIds",
                        foreignField: "_id",
                        as: "categories",
                    },
                },
            ])
            .toArray();

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: "Erreur de lecture", details: err.message });
    }
});

app.get("/products/:id", async (req, res) => {
    try {
        const _id = new ObjectId(req.params.id);
        const product = await db.collection("products").findOne({ _id });

        if (!product) return res.status(404).json({ error: "Produit introuvable" });

        res.json(product);
    } catch {
        res.status(400).json({ error: "ID invalide" });
    }
});

app.put("/products/:id", async (req, res) => {
    const result = await CreateProductSchema.safeParseAsync(req.body);
    if (!result.success) return res.status(400).json(result.error);

    try {
        const _id = new ObjectId(req.params.id);
        const categoryObjectIds = result.data.categoryIds.map((id) => new ObjectId(id));

        const ack = await db.collection("products").updateOne(
            { _id },
            {
                $set: {
                    name: result.data.name,
                    about: result.data.about,
                    price: result.data.price,
                    categoryIds: categoryObjectIds,
                },
            }
        );

        if (ack.matchedCount === 0) return res.status(404).json({ error: "Produit non trouvé" });

        res.json({ message: "Produit mis à jour" });

        io.emit("products", {
            action: "updated",
            id: req.params.id,
        });
    } catch {
        res.status(400).json({ error: "ID invalide" });
    }
});

app.delete("/products/:id", async (req, res) => {
    try {
        const _id = new ObjectId(req.params.id);
        const ack = await db.collection("products").deleteOne({ _id });

        if (ack.deletedCount === 0) return res.status(404).json({ error: "Produit non trouvé" });

        res.status(204).send();

        io.emit("products", {
            action: "deleted",
            id: req.params.id,
        });
    } catch {
        res.status(400).json({ error: "ID invalide" });
    }
});


client.connect().then(async () => {
    db = client.db("myDB");

    server.listen(port, () => {
        console.log(`✅ Listening on http://localhost:${port}`);
    });

    io.on("connection", (socket) => {
        console.log("✅ Un client est connecté");

        socket.on("disconnect", () => {
            console.log("❌ Client déconnecté");
        });
    });
});
