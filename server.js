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
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});
app.get("/director-login.html", (req, res) => {
    res.sendFile(path.join(__dirname, "director-login.html"));
});
const uploadDir = path.join("/tmp", "uploads");

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

app.use("/uploads", express.static(uploadDir));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname);
        const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
        cb(null, safeName);
    }
});

app.use("/uploads", express.static(uploadDir));
const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf"
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("نوع الملف غير مسموح به."));
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024
    }
});

const studentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    studentId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    gender: {
        type: String,
        required: true,
        trim: true
    },
    age: {
        type: Number,
        required: true,
        min: 1,
        max: 100
    },
    grade: {
        type: String,
        required: true,
        trim: true
    },
    parentPhone: {
        type: String,
        required: true,
        trim: true
    },
    subCity: {
        type: String,
        required: true,
        trim: true
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

const Student = mongoose.model("Student", studentSchema);

const directorSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    }
});

const settingsSchema = new mongoose.Schema({
    registrationOpen: {
        type: Boolean,
        default: true
    }
});

const Settings = mongoose.model("Settings", settingsSchema);
const Director = mongoose.model("Director", directorSchema);

const bookSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
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

const Book = mongoose.model("Book", bookSchema);

const certificateSchema = new mongoose.Schema({
    studentId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    studentName: {
        type: String,
        required: true,
        trim: true
    },
    grade: {
        type: String,
        required: true,
        trim: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    date: {
        type: String,
        required: true,
        trim: true
    },
    directorName: {
        type: String,
        required: true,
        trim: true
    },
    directorSignature: {
        type: String,
        required: true,
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Certificate = mongoose.model("Certificate", certificateSchema);
async function ensureDirector() {
    try {
        const email = process.env.DIRECTOR_EMAIL;
        const password = process.env.DIRECTOR_PASSWORD;

        if (!email || !password) {
            console.log("Director credentials are missing in .env");
            return;
        }

        const existingDirector = await Director.findOne({
            email: email.toLowerCase()
        });

        if (existingDirector) {
            console.log("Director account already exists.");
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        await Director.create({
            email: email.toLowerCase(),
            password: hashedPassword
        });

        console.log("Director account created successfully.");
    } catch (error) {
        console.error("Director setup failed:", error.message);
    }
}

function verifyDirector(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            message: "يجب تسجيل دخول المدير أولاً."
        });
    }

    const token = authHeader.split(" ")[1];

    if (!process.env.JWT_SECRET) {
        return res.status(500).json({
            message: "إعدادات الأمان غير مكتملة على الخادم."
        });
    }

    try {
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.director = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            message: "انتهت صلاحية تسجيل الدخول أو أن الرمز غير صالح."
        });
    }
}

app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        message: "خادم حلقا يعمل بنجاح."
    });
});

app.post("/api/director/login", async (req, res) => {
    try {
        const email = String(req.body.email || "")
            .trim()
            .toLowerCase();

        const password = String(req.body.password || "");

        if (!email || !password) {
            return res.status(400).json({
                message: "البريد الإلكتروني وكلمة المرور مطلوبان."
            });
        }

        if (!process.env.JWT_SECRET) {
            return res.status(500).json({
                message: "إعدادات الأمان غير مكتملة على الخادم."
            });
        }

        const director = await Director.findOne({ email });

        if (!director) {
            return res.status(401).json({
                message: "البريد الإلكتروني أو كلمة المرور غير صحيحة."
            });
        }

        const passwordMatch = await bcrypt.compare(
            password,
            director.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                message: "البريد الإلكتروني أو كلمة المرور غير صحيحة."
            });
        }

        const token = jwt.sign(
            {
                directorId: director._id.toString(),
                email: director.email
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "2h"
            }
        );

        res.json({
            message: "تم تسجيل دخول المدير بنجاح.",
            token
        });
    } catch (error) {
        console.error("Director login error:", error);

        res.status(500).json({
            message: "حدث خطأ أثناء تسجيل دخول المدير."
        });
    }
});
app.get("/api/registration-status", async (req, res) => {
    try {
        let settings = await Settings.findOne();

        if (!settings) {
            settings = await Settings.create({
                registrationOpen: true
            });
        }

        res.json({
            registrationOpen: settings.registrationOpen
        });
    } catch (error) {
        res.status(500).json({
            message: "تعذر تحميل حالة التسجيل."
        });
    }
});

app.put("/api/registration-status", verifyDirector, async (req, res) => {
    try {
        const registrationOpen = req.body.registrationOpen;

        if (typeof registrationOpen !== "boolean") {
            return res.status(400).json({
                message: "حالة التسجيل غير صحيحة."
            });
        }

        let settings = await Settings.findOne();

        if (!settings) {
            settings = await Settings.create({
                registrationOpen
            });
        } else {
            settings.registrationOpen = registrationOpen;
            await settings.save();
        }

        res.json({
            message: registrationOpen
                ? "تم فتح تسجيل الطلاب."
                : "تم إيقاف تسجيل الطلاب.",
            registrationOpen: settings.registrationOpen
        });
    } catch (error) {
        console.error("Registration status error:", error);

        res.status(500).json({
            message: "تعذر تغيير حالة التسجيل."
        });
    }
});

app.post(
    "/api/students/register",
    upload.single("photo"),
    async (req, res) => {
        try {
            const settings = await Settings.findOne();

if (settings && !settings.registrationOpen) {
    return res.status(403).json({
        message: "تم إيقاف تسجيل الطلاب حالياً."
    });
}
            const name = String(req.body.name || "").trim();
            const gender = String(req.body.gender || "").trim();
            const grade = String(req.body.grade || "").trim();
            const parentPhone = String(req.body.parentPhone || "").trim();
            const subCity = String(req.body.subCity || "").trim();
            const age = Number(req.body.age);

            if (
                !name ||
                !gender ||
                !grade ||
                !parentPhone ||
                !subCity ||
                !age
            ) {
                if (req.file && fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path);
                }

                return res.status(400).json({
                    message: "جميع بيانات الطالب مطلوبة."
                });
            }

            if (!req.file) {
                return res.status(400).json({
                    message: "صورة الطالب مطلوبة."
                });
            }

            if (age < 1 || age > 100) {
                fs.unlinkSync(req.file.path);

                return res.status(400).json({
                    message: "عمر الطالب غير صحيح."
                });
            }

            const lastStudent = await Student.findOne()
                .sort({ createdAt: -1 })
                .select("studentId");

            let nextNumber = 1;

            if (lastStudent && lastStudent.studentId) {
                const lastNumber = parseInt(
                    lastStudent.studentId.replace("AT", ""),
                    10
                );

                if (!Number.isNaN(lastNumber)) {
                    nextNumber = lastNumber + 1;
                }
            }

            let studentId = `AT${String(nextNumber).padStart(8, "0")}`;

            while (await Student.exists({ studentId })) {
                nextNumber += 1;
                studentId = `AT${String(nextNumber).padStart(8, "0")}`;
            }

            const student = await Student.create({
                name,
                studentId,
                gender,
                age,
                grade,
                parentPhone,
                subCity,
                photo: `/uploads/${req.file.filename}`
            });

            res.status(201).json({
                message: "تم تسجيل الطالب بنجاح.",
                studentId: student.studentId
            });
        } catch (error) {
            console.error("Student registration error:", error);

            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }

            if (error.code === 11000) {
                return res.status(409).json({
                    message: "حدث تعارض في رقم الطالب. حاول مرة أخرى."
                });
            }

            res.status(500).json({
                message: "فشل تسجيل الطالب."
            });
        }
    }
);

app.get("/api/students", verifyDirector, async (req, res) => {
    try {
        const students = await Student.find()
            .sort({ createdAt: -1 });

        res.json(students);
    } catch (error) {
        console.error("Students loading error:", error);

        res.status(500).json({
            message: "تعذر تحميل بيانات الطلاب."
        });
    }
});

app.delete("/api/students/:id", verifyDirector, async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);

        if (!student) {
            return res.status(404).json({
                message: "الطالب غير موجود."
            });
        }

        await Student.findByIdAndDelete(req.params.id);

        res.json({
            message: "تم حذف الطالب بنجاح."
        });
    } catch (error) {
        console.error("Student deletion error:", error);

        res.status(500).json({
            message: "فشل حذف الطالب."
        });
    }
});
app.post(
    "/api/books/upload",
    verifyDirector,
    upload.single("bookFile"),
    async (req, res) => {
        try {
            const bookTitle = String(
                req.body.bookTitle || ""
            ).trim();

            if (!bookTitle || !req.file) {
                if (req.file && fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path);
                }

                return res.status(400).json({
                    message: "عنوان الكتاب وملف PDF مطلوبان."
                });
            }

            if (req.file.mimetype !== "application/pdf") {
                fs.unlinkSync(req.file.path);

                return res.status(400).json({
                    message: "يسمح برفع ملفات PDF فقط للكتب."
                });
            }

            const book = await Book.create({
                title: bookTitle,
                file: `/uploads/${req.file.filename}`
            });

            res.status(201).json({
                message: "تم رفع الكتاب بنجاح.",
                book: {
                    id: book._id,
                    title: book.title,
                    file: book.file
                }
            });
        } catch (error) {
            console.error("Book upload error:", error);

            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }

            res.status(500).json({
                message: "فشل رفع الكتاب."
            });
        }
    }
);

app.get("/api/books", async (req, res) => {
    try {
        const books = await Book.find()
            .sort({ createdAt: -1 });

        res.json(books);
    } catch (error) {
        console.error("Books loading error:", error);

        res.status(500).json({
            message: "تعذر تحميل الكتب."
        });
    }
});

app.delete("/api/books/:id", verifyDirector, async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);

        if (!book) {
            return res.status(404).json({
                message: "الكتاب غير موجود."
            });
        }

        const relativeFile = book.file.replace(/^\/+/, "");
        const filePath = path.join(__dirname, relativeFile);

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        await Book.findByIdAndDelete(req.params.id);

        res.json({
            message: "تم حذف الكتاب بنجاح."
        });
    } catch (error) {
        console.error("Book deletion error:", error);

        res.status(500).json({
            message: "فشل حذف الكتاب."
        });
    }
});
app.post(
    "/api/certificates",
    verifyDirector,
    async (req, res) => {
        try {
            const studentId = String(req.body.studentId || "").trim();
            const title = String(req.body.title || "").trim();
            const date = String(req.body.date || "").trim();
            const directorName = String(req.body.directorName || "").trim();
            const directorSignature = String(
                req.body.directorSignature || ""
            ).trim();

            if (
                !studentId ||
                !title ||
                !date ||
                !directorName ||
                !directorSignature
            ) {
                return res.status(400).json({
                    message: "جميع بيانات الشهادة مطلوبة."
                });
            }

            const student = await Student.findOne({ studentId });

            if (!student) {
                return res.status(404).json({
                    message: "الطالب غير موجود."
                });
            }

            const existingCertificate = await Certificate.findOne({
                studentId
            });

            if (existingCertificate) {
                return res.status(409).json({
                    message: "هذا الطالب لديه شهادة بالفعل."
                });
            }

            const certificate = await Certificate.create({
                studentId: student.studentId,
                studentName: student.name,
                grade: student.grade,
                title,
                date,
                directorName,
                directorSignature
            });

            res.status(201).json({
                message: "تم حفظ الشهادة بنجاح.",
                certificate
            });
        } catch (error) {
            console.error("Certificate creation error:", error);

            if (error.code === 11000) {
                return res.status(409).json({
                    message: "هذا الطالب لديه شهادة بالفعل."
                });
            }

            res.status(500).json({
                message: "تعذر حفظ الشهادة."
            });
        }
    }
);

app.get(
    "/api/certificates",
    verifyDirector,
    async (req, res) => {
        try {
            const certificates = await Certificate.find()
                .sort({ createdAt: -1 });

            res.json(certificates);
        } catch (error) {
            console.error("Certificates loading error:", error);

            res.status(500).json({
                message: "تعذر تحميل الشهادات."
            });
        }
    }
);

app.get(
    "/api/certificates/:studentId",
    verifyDirector,
    async (req, res) => {
        try {
            const studentId = String(
                req.params.studentId || ""
            ).trim();

            if (!studentId) {
                return res.status(400).json({
                    message: "رقم الطالب مطلوب."
                });
            }

            const certificate = await Certificate.findOne({
                studentId
            });

            if (!certificate) {
                return res.status(404).json({
                    message: "لم يتم العثور على الشهادة."
                });
            }

            res.json(certificate);
        } catch (error) {
            console.error("Certificate loading error:", error);

            res.status(500).json({
                message: "تعذر تحميل الشهادة."
            });
        }
    }
);

app.use((error, req, res, next) => {
    console.error("Server error:", error);

    if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
                message: "حجم الملف كبير جداً. الحد الأقصى هو 50 ميجابايت."
            });
        }

        return res.status(400).json({
            message: "حدث خطأ أثناء رفع الملف."
        });
    }

    if (error.message === "نوع الملف غير مسموح به.") {
        return res.status(400).json({
            message: "نوع الملف غير مسموح به."
        });
    }

    res.status(500).json({
        message: "حدث خطأ في الخادم."
    });
});

let mongoConnection = null;

async function connectDatabase() {
    if (!process.env.MONGODB_URI) {
        throw new Error("MONGODB_URI is missing");
    }

    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is missing");
    }

    if (!mongoConnection) {
        mongoConnection = mongoose.connect(process.env.MONGODB_URI)
            .then(async () => {
                console.log("MongoDB connected successfully.");
                await ensureDirector();
            });
    }

    return mongoConnection;
}

app.use("/api", async (req, res, next) => {
    try {
        await connectDatabase();
        next();
    } catch (error) {
        console.error("Database connection failed:", error.message);
        res.status(500).json({
            message: "Database connection failed."
        });
    }
});
if (require.main === module) {
    connectDatabase()
        .then(() => {
            app.listen(PORT, () => {
                console.log(`Halqa server is running on port ${PORT}`);
            });
        })
        .catch((error) => {
            console.error("Server startup failed:", error.message);
        });
}
module.exports = app;