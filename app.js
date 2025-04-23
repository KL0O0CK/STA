document.addEventListener("DOMContentLoaded", function () {
  const state = {
    selectedThreats: new Set(),
    currentTheme: localStorage.getItem("theme") || "dark",
    threatsData: null,
    currentView: localStorage.getItem("view") || "threats",
  };

  function initTheme() {
    document.documentElement.setAttribute("data-theme", state.currentTheme);
    updateThemeButton();
  }

  function toggleTheme() {
    state.currentTheme = state.currentTheme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", state.currentTheme);
    localStorage.setItem("theme", state.currentTheme);
    updateThemeButton();
    renderSelectedContent();
  }

  function updateThemeButton() {
    const themeToggle = document.getElementById("theme-toggle");
    if (themeToggle) {
      themeToggle.innerHTML =
        state.currentTheme === "dark"
          ? "<span>🌞</span> Светлая тема"
          : "<span>🌙</span> Тёмная тема";
    }
  }

  async function loadThreatsData() {
    try {
      showLoading("threats-list", "Загрузка данных об угрозах...");
      const response = await fetch("threats_final.json");
      if (!response.ok) throw new Error("Ошибка загрузки данных");
      state.threatsData = await response.json();
      renderThreatsList(getSortedThreats());
    } catch (error) {
      showError("threats-list", error.message);
    }
  }

  function getSortedThreats() {
    if (!state.threatsData) return [];
    return Object.keys(state.threatsData).sort((a, b) => {
      const numA = parseInt(a.split(".")[1]);
      const numB = parseInt(b.split(".")[1]);
      return numA - numB;
    });
  }

  function renderThreatsList(threats) {
    const container = document.getElementById("threats-list");
    container.innerHTML = "";

    threats.forEach((threatId) => {
      const threat = state.threatsData[threatId];
      const threatElement = document.createElement("div");
      threatElement.className = "threat-item";

      const button = document.createElement("button");
      button.className = `threat-btn ${
        state.selectedThreats.has(threatId) ? "selected" : ""
      }`;
      button.innerHTML = `
        <div class="threat-id">${threatId}</div>
        <div class="threat-description">${
          threat?.description || "Нет описания"
        }</div>
      `;

      button.addEventListener("click", () => {
        if (state.selectedThreats.has(threatId)) {
          state.selectedThreats.delete(threatId);
          button.classList.remove("selected");
        } else {
          state.selectedThreats.add(threatId);
          button.classList.add("selected");
        }
        updateShowButtonState();
      });

      threatElement.appendChild(button);
      container.appendChild(threatElement);
    });
  }

  function showSelectedThreats() {
    if (state.selectedThreats.size === 0) {
      showError("threat-details", "Выберите хотя бы одну угрозу");
      return;
    }

    const detailsContainer = document.getElementById("threat-details");
    detailsContainer.innerHTML = `
      <div class="view-options">
        <button class="btn view-btn" data-view="threats">
          Отдельные объекты и способы
        </button>
        <button class="btn view-btn" data-view="summary">
          Общие объекты и способы
        </button>
      </div>
      <div class="summary-section">
        <h2>Выбрано угроз: ${state.selectedThreats.size}</h2>
        <button id="generate-pdf" class="btn">Создать PDF отчет</button>
      </div>
      <div id="threats-container"></div>
    `;

    document.querySelectorAll(".view-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        state.currentView = this.dataset.view;
        localStorage.setItem("view", state.currentView);
        renderSelectedContent();
      });
    });

    renderSelectedContent();
    document
      .getElementById("generate-pdf")
      .addEventListener("click", generatePDF);
  }

  function renderSelectedContent() {
    const container = document.getElementById("threats-container");
    if (!container) return;

    document.querySelectorAll(".view-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === state.currentView);
    });

    if (state.currentView === "threats") {
      renderThreatsView(container);
    } else {
      renderSummaryView(container);
    }
  }

  function renderThreatsView(container) {
    container.innerHTML = Array.from(state.selectedThreats)
      .map((threatId) => {
        const threat = state.threatsData[threatId];
        return `
          <div class="threat-details-section">
            <h3>${threatId}: ${threat.description || ""}</h3>

            <div class="threat-section">
              <h4>Объекты воздействия</h4>
              <ul>
                ${threat.objects
                  .map(
                    (obj) => `
                  <li><strong>${obj.id}</strong>: ${obj.name}${
                      obj.type ? ` (${obj.type})` : ""
                    }</li>
                `
                  )
                  .join("")}
              </ul>
            </div>

            <div class="threat-section">
              <h4>Способы реализации</h4>и
              <ul>
                ${threat.implementations
                  .map(
                    (impl) => `
                  <li>
                    <strong>${impl.id}</strong>: ${impl.name}
                    ${
                      impl.category
                        ? `<div>Категория: ${impl.category}</div>`
                        : ""
                    }
                    ${
                      impl.risk_level
                        ? `<div>Уровень риска: ${impl.risk_level}</div>`
                        : ""
                    }
                  </li>
                `
                  )
                  .join("")}
              </ul>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function renderSummaryView(container) {
    const uniqueObjects = new Map();
    const uniqueMethods = new Map();

    Array.from(state.selectedThreats).forEach((threatId) => {
      const threat = state.threatsData[threatId];

      threat.objects.forEach((obj) => {
        if (!uniqueObjects.has(obj.id)) {
          uniqueObjects.set(obj.id, obj);
        }
      });

      threat.implementations.forEach((impl) => {
        if (!uniqueMethods.has(impl.id)) {
          uniqueMethods.set(impl.id, impl);
        }
      });
    });

    container.innerHTML = `
      <div class="summary-section">
        <div class="summary-block">
          <h3>Все объекты воздействия (${uniqueObjects.size})</h3>
          <ul class="objects-list">
            ${Array.from(uniqueObjects.values())
              .map(
                (obj) => `
              <li><strong>${obj.id}</strong>: ${obj.name}${
                  obj.type ? ` (${obj.type})` : ""
                }</li>
            `
              )
              .join("")}
          </ul>
        </div>

        <div class="summary-block">
          <h3>Все способы реализации (${uniqueMethods.size})</h3>
          <ul class="methods-list">
            ${Array.from(uniqueMethods.values())
              .map(
                (impl) => `
              <li>
                <strong>${impl.id}</strong>: ${impl.name}
                ${impl.category ? `<div>Категория: ${impl.category}</div>` : ""}
                ${
                  impl.risk_level
                    ? `<div>Уровень риска: ${impl.risk_level}</div>`
                    : ""
                }
              </li>
            `
              )
              .join("")}
          </ul>
        </div>
      </div>
    `;
  }

  function handleSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    if (!searchTerm) {
      renderSelectedContent();
      return;
    }

    const container = document.getElementById("threats-container");
    if (!container) return;

    if (state.currentView === "threats") {
      const content = Array.from(state.selectedThreats)
        .map((threatId) => {
          const threat = state.threatsData[threatId];
          const filteredObjects = threat.objects.filter(
            (obj) =>
              obj.id.toLowerCase().includes(searchTerm) ||
              obj.name.toLowerCase().includes(searchTerm) ||
              (obj.type && obj.type.toLowerCase().includes(searchTerm))
          );

          const filteredImplementations = threat.implementations.filter(
            (impl) =>
              impl.id.toLowerCase().includes(searchTerm) ||
              impl.name.toLowerCase().includes(searchTerm) ||
              (impl.category &&
                impl.category.toLowerCase().includes(searchTerm)) ||
              (impl.risk_level &&
                impl.risk_level.toLowerCase().includes(searchTerm))
          );

          if (
            filteredObjects.length === 0 &&
            filteredImplementations.length === 0
          ) {
            return "";
          }

          return `
            <div class="threat-details-section">
              <h3>${threatId}: ${threat.description || ""}</h3>

              ${
                filteredObjects.length > 0
                  ? `
                <div class="threat-section">
                  <h4>Объекты воздействия</h4>
                  <ul>
                    ${filteredObjects
                      .map(
                        (obj) => `
                      <li><strong>${obj.id}</strong>: ${obj.name}${
                          obj.type ? ` (${obj.type})` : ""
                        }</li>
                    `
                      )
                      .join("")}
                  </ul>
                </div>
              `
                  : ""
              }

              ${
                filteredImplementations.length > 0
                  ? `
                <div class="threat-section">
                  <h4>Способы реализации</h4>
                  <ul>
                    ${filteredImplementations
                      .map(
                        (impl) => `
                      <li>
                        <strong>${impl.id}</strong>: ${impl.name}
                        ${
                          impl.category
                            ? `<div>Категория: ${impl.category}</div>`
                            : ""
                        }
                        ${
                          impl.risk_level
                            ? `<div>Уровень риска: ${impl.risk_level}</div>`
                            : ""
                        }
                      </li>
                    `
                      )
                      .join("")}
                  </ul>
                </div>
              `
                  : ""
              }
            </div>
          `;
        })
        .filter((content) => content !== "")
        .join("");

      container.innerHTML =
        content || '<div class="empty-state">Ничего не найдено</div>';
    } else {
      const uniqueObjects = new Map();
      const uniqueMethods = new Map();

      Array.from(state.selectedThreats).forEach((threatId) => {
        const threat = state.threatsData[threatId];

        threat.objects.forEach((obj) => {
          if (
            obj.id.toLowerCase().includes(searchTerm) ||
            obj.name.toLowerCase().includes(searchTerm) ||
            (obj.type && obj.type.toLowerCase().includes(searchTerm))
          ) {
            if (!uniqueObjects.has(obj.id)) {
              uniqueObjects.set(obj.id, obj);
            }
          }
        });

        threat.implementations.forEach((impl) => {
          if (
            impl.id.toLowerCase().includes(searchTerm) ||
            impl.name.toLowerCase().includes(searchTerm) ||
            (impl.category &&
              impl.category.toLowerCase().includes(searchTerm)) ||
            (impl.risk_level &&
              impl.risk_level.toLowerCase().includes(searchTerm))
          ) {
            if (!uniqueMethods.has(impl.id)) {
              uniqueMethods.set(impl.id, impl);
            }
          }
        });
      });

      container.innerHTML = `
        <div class="summary-section">
          ${
            uniqueObjects.size > 0
              ? `
            <div class="summary-block">
              <h3>Найденные объекты воздействия (${uniqueObjects.size})</h3>
              <ul class="objects-list">
                ${Array.from(uniqueObjects.values())
                  .map(
                    (obj) => `
                    <li><strong>${obj.id}</strong>: ${obj.name}${
                      obj.type ? ` (${obj.type})` : ""
                    }</li>
                  `
                  )
                  .join("")}
              </ul>
            </div>
          `
              : ""
          }

          ${
            uniqueMethods.size > 0
              ? `
            <div class="summary-block">
              <h3>Найденные способы реализации (${uniqueMethods.size})</h3>
              <ul class="methods-list">
                ${Array.from(uniqueMethods.values())
                  .map(
                    (impl) => `
                    <li>
                      <strong>${impl.id}</strong>: ${impl.name}
                      ${
                        impl.category
                          ? `<div>Категория: ${impl.category}</div>`
                          : ""
                      }
                      ${
                        impl.risk_level
                          ? `<div>Уровень риска: ${impl.risk_level}</div>`
                          : ""
                      }
                    </li>
                  `
                  )
                  .join("")}
              </ul>
            </div>
          `
              : ""
          }

          ${
            uniqueObjects.size === 0 && uniqueMethods.size === 0
              ? '<div class="empty-state">Ничего не найдено</div>'
              : ""
          }
        </div>
      `;
    }
  }

  let robotoFont = null;

  async function loadFont() {
    try {
      const response = await fetch("fonts/Roboto-Regular.ttf");
      if (!response.ok) throw new Error("Не удалось загрузить шрифт");
      return await response.arrayBuffer();
    } catch (error) {
      console.error("Ошибка загрузки шрифта:", error);
      throw error;
    }
  }

  async function generatePDF() {
    try {
      if (!window.PDFLib) {
        throw new Error("Библиотека PDF-Lib не загружена");
      }

      const { PDFDocument, rgb } = window.PDFLib;
      const pdfDoc = await PDFDocument.create();
      pdfDoc.registerFontkit(window.fontkit);

      if (!robotoFont) {
        robotoFont = await loadFont();
      }
      const font = await pdfDoc.embedFont(robotoFont);

      let page = pdfDoc.addPage([595, 842]);
      const margin = 50;
      let y = page.getHeight() - margin;
      const lineHeight = 20;
      const maxWidth = 500;

      const addText = (text, size = 12, isBold = false, x = margin) => {
        const words = text.split(" ");
        let currentLine = "";

        for (let i = 0; i < words.length; i++) {
          const word = words[i];
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const testWidth = font.widthOfTextAtSize(testLine, size);

          if (testWidth > maxWidth) {
            if (currentLine) {
              drawLine(currentLine, size, isBold, x);
              currentLine = word;
            } else {
              const part = word.slice(
                0,
                Math.floor((word.length * maxWidth) / testWidth)
              );
              drawLine(part, size, isBold, x);
              currentLine = word.slice(part.length);
            }
          } else {
            currentLine = testLine;
          }
        }

        if (currentLine) drawLine(currentLine, size, isBold, x);
      };

      const drawLine = (text, size, isBold, x) => {
        if (y < margin) {
          page = pdfDoc.addPage([595, 842]);
          y = page.getHeight() - margin;
        }

        page.drawText(text, {
          x,
          y,
          size,
          font,
          color: rgb(0, 0, 0),
          ...(isBold && { font: font }),
        });

        y -= lineHeight;
      };

      addText("Отчет по угрозам безопасности", 18, true);
      y -= lineHeight;

      const now = new Date();
      const dateStr = now.toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      addText(`Дата создания: ${dateStr}`, 12);
      y -= lineHeight * 2;

      if (state.currentView === "threats") {
        Array.from(state.selectedThreats).forEach((threatId) => {
          const threat = state.threatsData[threatId];
          addText(`${threatId}: ${threat.description || ""}`, 14, true);
          y -= lineHeight;

          addText("Объекты воздействия:", 12, true);
          threat.objects.forEach((obj) => {
            addText(
              `• ${obj.id}: ${obj.name}${obj.type ? ` (${obj.type})` : ""}`
            );
          });
          y -= lineHeight;

          addText("Способы реализации:", 12, true);
          threat.implementations.forEach((impl) => {
            addText(`• ${impl.id}: ${impl.name}`);
            if (impl.category) addText(`  Категория: ${impl.category}`);
            if (impl.risk_level) addText(`  Уровень риска: ${impl.risk_level}`);
          });
          y -= lineHeight * 2;
        });
      } else {
        const uniqueObjects = new Map();
        const uniqueMethods = new Map();

        Array.from(state.selectedThreats).forEach((threatId) => {
          const threat = state.threatsData[threatId];

          threat.objects.forEach((obj) => {
            if (!uniqueObjects.has(obj.id)) {
              uniqueObjects.set(obj.id, obj);
            }
          });

          threat.implementations.forEach((impl) => {
            if (!uniqueMethods.has(impl.id)) {
              uniqueMethods.set(impl.id, impl);
            }
          });
        });

        addText("Все объекты воздействия:", 14, true);
        y -= lineHeight;
        Array.from(uniqueObjects.values()).forEach((obj) => {
          addText(
            `• ${obj.id}: ${obj.name}${obj.type ? ` (${obj.type})` : ""}`
          );
        });
        y -= lineHeight * 2;

        addText("Все способы реализации:", 14, true);
        y -= lineHeight;
        Array.from(uniqueMethods.values()).forEach((impl) => {
          addText(`• ${impl.id}: ${impl.name}`);
          if (impl.category) addText(`  Категория: ${impl.category}`);
          if (impl.risk_level) addText(`  Уровень риска: ${impl.risk_level}`);
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `Отчет_по_угрозам_${now.toISOString().slice(0, 10)}.pdf`;
      link.click();
    } catch (error) {
      console.error("Ошибка при генерации PDF:", error);
      alert(`Ошибка: ${error.message}`);
    }
  }

  function updateShowButtonState() {
    const btn = document.getElementById("show-selected");
    if (btn) btn.disabled = state.selectedThreats.size === 0;
  }

  function clearSelection() {
    state.selectedThreats.clear();
    document.querySelectorAll(".threat-btn").forEach((btn) => {
      btn.classList.remove("selected");
    });
    document.getElementById("threat-details").innerHTML =
      '<div class="empty-state">Выберите угрозы из списка</div>';
    updateShowButtonState();
  }

  function showLoading(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) el.innerHTML = `<div class="loading">${message}</div>`;
  }

  function showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) el.innerHTML = `<div class="error">${message}</div>`;
  }

  function init() {
    initTheme();
    document
      .getElementById("show-selected")
      .addEventListener("click", showSelectedThreats);
    document
      .getElementById("clear-selection")
      .addEventListener("click", clearSelection);
    document
      .getElementById("theme-toggle")
      .addEventListener("click", toggleTheme);
    document
      .getElementById("details-search")
      .addEventListener("input", handleSearch);

    loadThreatsData();
  }

  init();
});
