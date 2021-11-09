const express = require('express')
const app = express()
const cors = require('cors')
const port = process.env.PORT || 5000
require("dotenv").config();
const { MongoClient } = require('mongodb');
const admin = require("firebase-admin");

// doctors-portal-c59a4-firebase-adminsdk.json

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.64ycs.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
//jwt token
async function verifyToken(req, res, next) {
    if (req.headers?.authorization?.startWith(`Bearer `)) {
        const token = req.headers.authorization.split('')[1]

        try {
            const decodedUser = await admin.auth().verifyToken(token)
            req.decodedEmail = decodedUser.email
        }
        catch {

        }

    }
    next()
}


async function run() {
    try {
        await client.connect()
        const database = client.db("doctors_portal");
        const appointmentsCollection = database.collection("appointments");
        const usersCollection = database.collection("users");

        //filtering data from database and find data which match the email and also sorting date
        app.get('/appointments', verifyToken, async (req, res) => {
            const email = req.query.email;
            const date = new Date(req.query.date).toLocaleDateString()
            const query = { email: email, date: date }
            const cursor = appointmentsCollection.find(query)
            const appointments = await cursor.toArray()
            res.json(appointments)
        })
        //inserting data from appointment section
        app.post('/appointments', async (req, res) => {
            const appointment = req.body;
            const result = await appointmentsCollection.insertOne(appointment)
            console.log(result)
            res.json(result)
        });
        //finding admin role
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query)
            let isAdmin = false;
            if (user?.role === 'admin') {
                isAdmin = true;
            }
            res.json({ admin: isAdmin });
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user)
            console.log(result)
            res.json(result)
        });
        //Google login//upsert/update existing data or add new data in mongo database
        app.put('/users', async (req, res) => {
            const user = req.body;
            const filter = { email: user.email };
            const options = { upsert: true };
            const updateDoc = { $set: user };
            const result = await usersCollection.updateOne(filter, updateDoc, options)
            res.json(result)
        });

        //MAKE ADMIN
        app.put('/users/admin', verifyToken, async (req, res) => {
            const user = req.body;
            ////////////////////JWT///////////////////////////
            const requester = req.decodedEmail;
            if (requester) {
                const requesterAccount = usersCollection.findOne({ email: requester });
                if (requesterAccount.role === 'admin') {
                    ////////////////////////////////////////////////
                    const filter = { email: user.email };
                    const updateDoc = { $set: { role: 'admin' } };
                    const result = await usersCollection.updateOne(filter, updateDoc);
                    res.json(result)
                }
            }
            else {
                res.status(403).json({ message: 'Tou do not have access to make admin' })
            }


        })
    }
    finally {
        // await client.close()
    }

}
run().catch(console.dir)

console.log(uri)
app.get('/', (req, res) => {
    res.send('Hello Doctors Portal!')
})

app.listen(port, () => {
    console.log(`Example app listening at :${port}`)
})