const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

const uploadFolder = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadFolder)) {
    fs.mkdirSync(uploadFolder, { recursive: true });
}

app.use("/uploads", express.static(uploadFolder));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadFolder);
    },

    filename: (req, file, cb) => {
        const fileName =
            Date.now() + "-" + file.originalname;

        cb(null, fileName);
    }
});

const upload = multer({
    storage: storage,

    limits: {
        fileSize: 200 * 1024 * 1024
    }
});

const studentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },

    studentId: {
        type: String,
        required: true,
        unique: true
    },

    gender: {
        type: String,
        required: true
    },

    age: {
        type: Number,
        required: true
    },

    grade: {
        type: String,
        required: true
    },

    parentPhone: {
        type: String,
        required: true
    },

    subCity: {
        type: String,
        required: true
    },

    photo: {
        type: String,
        required: true
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Student =
    mongoose.model("Student", studentSchema);

const directorSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },

    password: {
        type: String,
        required: true
    }
});

const Director =
    mongoose.model("Director", directorSchema);

const bookSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },

    file: {
        type: String,
        required: true
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Book =
    mongoose.model("Book", bookSchema);

const certificateSchema = new mongoose.Schema({
    studentId: {
        type: String,
        required: true,
        unique: true
    },

    studentName: {
        type: String,
        required: true
    },

    grade: {
        type: String,
        required: true
    },

    title: {
        type: String,
        required: true
    },

    date: {
        type: String,
        required: true
    },

    directorName: {
        type: String,
        required: true
    },

    directorSignature: {
        type: String,
        required: true
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Certificate =
    mongoose.model(
        "Certificate",
        certificateSchema
    );

async function ensureDirector() {
    try {
        const email =
            process.env.DIRECTOR_EMAIL;

        const password =
            process.env.DIRECTOR_PASSWORD;

        if (!email || !password) {
            console.log(
                "Director credentials are missing in .env"
            );
            return;
        }

        const existingDirector =
            await Director.findOne({ email });

        if (existingDirector) {
            console.log(
                "Director account already exists."
            );
            return;
        }

        const hashedPassword =
            await bcrypt.hash(
                password,
                10
            );

        const director =
            new Director({
                email,
                password: hashedPassword
            });

        await director.save();

        console.log(
            "Director account created successfully."
        );

    } catch (error) {
        console.error(
            "Director setup failed:"
        );

        console.error(error.message);
    }
}

function verifyDirector(req, res, next) {
    const authHeader =
        req.headers.authorization;

    if (
        !authHeader ||
        !authHeader.startsWith("Bearer ")
    ) {
        return res.status(401).json({
            message:
                "Director authorization required."
        });
    }

    const token =
        authHeader.split(" ")[1];

    try {
        const decoded =
            jwt.verify(
                token,
                process.env.JWT_SECRET
            );

        req.director = decoded;

        next();

    } catch (error) {
        return res.status(401).json({
            message:
                "Invalid or expired Director token."
        });
    }
}

app.post(
    "/api/director/login",
    async (req, res) => {
        try {
            const {
                email,
                password
            } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    message:
                        "Email and password are required."
                });
            }

            const director =
                await Director.findOne({
                    email
                });

            if (!director) {
                return res.status(401).json({
                    message:
                        "Invalid email or password."
                });
            }

            const passwordMatch =
                await bcrypt.compare(
                    password,
                    director.password
                );

            if (!passwordMatch) {
                return res.status(401).json({
                    message:
                        "Invalid email or password."
                });
            }

            const token =
                jwt.sign(
                    {
                        directorId:
                            director._id,

                        email:
                            director.email
                    },

                    process.env.JWT_SECRET,

                    {
                        expiresIn: "2h"
                    }
                );

            res.json({
                message:
                    "Director login successful.",

                token
            });

        } catch (error) {
            console.error(error);

            res.status(500).json({
                message:
                    "Director login failed."
            });
        }
    }
);

app.post(
    "/api/students/register",
    upload.single("photo"),
    async (req, res) => {
        try {
            const {
                name,
                gender,
                age,
                grade,
                parentPhone,
                subCity
            } = req.body;

            if (
                !name ||
                !gender ||
                !age ||
                !grade ||
                !parentPhone ||
                !subCity
            ) {
                return res.status(400).json({
                    message:
                        "All student fields are required."
                });
            }

            if (!req.file) {
                return res.status(400).json({
                    message:
                        "Student photo is required."
                });
            }

            const lastStudent =
                await Student.findOne()
                    .sort({
                        createdAt: -1
                    });

            let nextNumber = 1;

            if (
                lastStudent &&
                lastStudent.studentId
            ) {
                const lastNumber =
                    parseInt(
                        lastStudent.studentId.replace(
                            "AT",
                            ""
                        ),
                        10
                    );

                if (!isNaN(lastNumber)) {
                    nextNumber =
                        lastNumber + 1;
                }
            }

            const studentId =
                "AT" +
                String(nextNumber).padStart(
                    8,
                    "0"
                );

            const student =
                new Student({
                    name,
                    studentId,
                    gender,
                    age,
                    grade,
                    parentPhone,
                    subCity,
                    photo:
                        `/uploads/${req.file.filename}`
                });

            await student.save();

            res.status(201).json({
                message:
                    "Student registered successfully.",

                studentId:
                    student.studentId
            });

        } catch (error) {
            console.error(error);

            res.status(500).json({
                message:
                    "Student registration failed."
            });
        }
    }
);

app.get(
    "/api/students",
    verifyDirector,
    async (req, res) => {
        try {
            const students =
                await Student.find()
                    .sort({
                        createdAt: -1
                    });

            res.json(students);

        } catch (error) {
            console.error(error);

            res.status(500).json({
                message:
                    "Students could not be loaded."
            });
        }
    }
);

app.post(
    "/api/books/upload",
    verifyDirector,
    upload.single("bookFile"),
    async (req, res) => {
        try {
            const {
                bookTitle
            } = req.body;

            if (
                !bookTitle ||
                !req.file
            ) {
                return res.status(400).json({
                    message:
                        "Book title and PDF file are required."
                });
            }

            const book =
                new Book({
                    title:
                        bookTitle,

                    file:
                        `/uploads/${req.file.filename}`
                });

            await book.save();

            res.status(201).json({
                message:
                    "Book uploaded successfully.",

                book: {
                    id:
                        book._id,

                    title:
                        book.title,

                    file:
                        book.file
                }
            });

        } catch (error) {
            console.error(error);

            res.status(500).json({
                message:
                    "Book upload failed."
            });
        }
    }
);

app.get(
    "/api/books",
    async (req, res) => {
        try {
            const books =
                await Book.find()
                    .sort({
                        createdAt: -1
                    });

            res.json(books);

        } catch (error) {
            console.error(error);

            res.status(500).json({
                message:
                    "Books could not be loaded."
            });
        }
    }
);

app.delete(
    "/api/books/:id",
    verifyDirector,
    async (req, res) => {
        try {
            const book =
                await Book.findById(
                    req.params.id
                );

            if (!book) {
                return res.status(404).json({
                    message:
                        "Book not found."
                });
            }

            const filePath =
                path.join(
                    __dirname,
                    book.file.replace(
                        "/uploads/",
                        "uploads/"
                    )
                );

            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

            await Book.findByIdAndDelete(
                req.params.id
            );

            res.json({
                message:
                    "Book deleted successfully."
            });

        } catch (error) {
            console.error(error);

            res.status(500).json({
                message:
                    "Book deletion failed."
            });
        }
    }
);

app.get(
    "/api/certificates/student/:studentId",
    async (req, res) => {
        try {
            const certificate =
                await Certificate.findOne({
                    studentId:
                        req.params.studentId
                });

            if (!certificate) {
                return res.status(404).json({
                    message:
                        "Certificate not found. | لم يتم العثور على الشهادة."
                });
            }

            res.json({
                studentId:
                    certificate.studentId,

                studentName:
                    certificate.studentName,

                grade:
                    certificate.grade,

                title:
                    certificate.title,

                date:
                    certificate.date,

                directorName:
                    certificate.directorName,

                directorSignature:
                    certificate.directorSignature
            });

        } catch (error) {
            console.error(error);

            res.status(500).json({
                message:
                    "Certificate could not be loaded."
            });
        }
    }
);

app.post(
    "/api/certificates",
    verifyDirector,
    async (req, res) => {
        try {
            const {
                studentId,
                studentName,
                grade,
                title,
                date,
                directorName,
                directorSignature
            } = req.body;

            if (
                !studentId ||
                !studentName ||
                !grade ||
                !title ||
                !date ||
                !directorName ||
                !directorSignature
            ) {
                return res.status(400).json({
                    message:
                        "All certificate fields are required."
                });
            }

            const existingCertificate =
                await Certificate.findOne({
                    studentId
                });

            if (existingCertificate) {
                return res.status(400).json({
                    message:
                        "This student already has a certificate."
                });
            }

            const certificate =
                new Certificate({
                    studentId,
                    studentName,
                    grade,
                    title,
                    date,
                    directorName,
                    directorSignature
                });

            await certificate.save();

            res.status(201).json({
                message:
                    "Certificate saved successfully.",

                certificate
            });

        } catch (error) {
            console.error(error);

            res.status(500).json({
                message:
                    "Certificate could not be saved."
            });
        }
    }
);

app.get(
    "/api/certificates",
    verifyDirector,
    async (req, res) => {
        try {
            const certificates =
                await Certificate.find()
                    .sort({
                        createdAt: -1
                    });

            res.json(certificates);

        } catch (error) {
            console.error(error);

            res.status(500).json({
                message:
                    "Certificates could not be loaded."
            });
        }
    }
);

mongoose.connect(
    process.env.MONGODB_URI
)
.then(() => {
    console.log(
        "MongoDB connected successfully."
    );

    ensureDirector();

    app.listen(PORT, () => {
        console.log(
            `Halqa server is running on port ${PORT}`
        );
    });
})
.catch((error) => {
    console.error(
        "MongoDB connection failed:"
    );

    console.error(
        error.message
    );
});