document.addEventListener("DOMContentLoaded", () => {
    const currentPage = window.location.pathname.split("/").pop();

    const navLinks = document.querySelectorAll("nav a");

    navLinks.forEach(link => {
        const linkPage = link.getAttribute("href");

        if (linkPage === currentPage) {
            link.classList.add("active");
        }
    });

    const darkModeBtn = document.getElementById("darkModeBtn");

    if (darkModeBtn) {
        const savedMode = localStorage.getItem("halqaDarkMode");

        if (savedMode === "enabled") {
            document.body.classList.add("dark");
            darkModeBtn.textContent = "☀️";
        } else {
            darkModeBtn.textContent = "🌙";
        }

        darkModeBtn.addEventListener("click", () => {
            document.body.classList.toggle("dark");

            if (document.body.classList.contains("dark")) {
                darkModeBtn.textContent = "☀️";
                localStorage.setItem("halqaDarkMode", "enabled");
            } else {
                darkModeBtn.textContent = "🌙";
                localStorage.setItem("halqaDarkMode", "disabled");
            }
        });
    }

    console.log("Halqa website loaded successfully.");
});