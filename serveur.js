const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const { z } = require("zod");

const app = express();
const port = 8000;
const client = new MongoClient("mongodb://localhost:27017");
let db;

app.use(express.json());

const ProductSchema = z.object({
    _id: z.string(),
    name: z.string(),
    about: z.string(),
    price: z.number().positive(),
    categoryIds: z.array(z.string())
});
const CreateProductSchema = ProductSchema.omit({ _id: true });

const CategorySchema = z.object({
    _id: z.string(),
    name: z.string(),
});
const CreateCategorySchema = CategorySchema.omit({ _id: true });

app.post("/categories", async (req, res) => {
    const result = await CreateCategorySchema.safeParse(req.body);

    if (result.success) {
        const { name } = result.data;
        const ack = await db.collection("categories").insertOne({ name });
        res.send({ _id: ack.insertedId, name });
    } else {
        res.status(400).send(result);
    }
});

app.post("/products", async (req, res) => {
    const result = await CreateProductSchema.safeParse(req.body);

    if (result.success) {
        const { name, about, price, categoryIds } = result.data;
        const categoryObjectIds = categoryIds.map((id) => new ObjectId(id));

        const ack = await db.collection("products").insertOne({
            name,
            about,
            price,
            categoryIds: categoryObjectIds,
        });

        res.send({
            _id: ack.insertedId,
            name,
            about,
            price,
            categoryIds: categoryObjectIds,
        });
    } else {
        res.status(400).send(result);
    }
});

app.get("/products", async (req, res) => {
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

    res.send(result);
});

client.connect().then(async () => {
    db = client.db("myDB");

    // Insert sample documents in "documents" collection
    const collection = db.collection("documents");

    const insertResult = await collection.insertMany([{ a: 1 }, { a: 2 }, { a: 3 }]);
    console.log("Inserted documents =>", insertResult);

    const findResult = await collection.find({}).toArray();
    console.log("Found documents =>", findResult);

    const filteredDocs = await collection.find({ a: 3 }).toArray();
    console.log("Found documents filtered by { a: 3 } =>", filteredDocs);

    app.listen(port, () => {
        console.log(`✅ Listening on http://localhost:${port}`);
    });
});
