document.addEventListener("DOMContentLoaded", () => {
    const menuToggle = document.getElementById("menuToggle");
    const dropdownMenu = document.getElementById("dropdownMenu");

    // Abre e fecha o menu ao clicar no botão ⋮
    menuToggle.addEventListener("click", () => {
        dropdownMenu.style.display =
            dropdownMenu.style.display === "block" ? "none" : "block";
    });

    // Fecha o menu ao clicar fora dele
    document.addEventListener("click", (event) => {
        if (!dropdownMenu.contains(event.target) && event.target !== menuToggle) {
            dropdownMenu.style.display = "none";
        }
    });
});
