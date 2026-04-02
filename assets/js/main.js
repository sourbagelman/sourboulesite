(function () {
  const faviconHref = "images/logo.png";

  let favicon = document.querySelector("link[rel='icon']");
  if (!favicon) {
    favicon = document.createElement("link");
    favicon.rel = "icon";
    document.head.appendChild(favicon);
  }

  favicon.type = "image/jpeg";
  favicon.href = faviconHref;
})();

document.addEventListener("DOMContentLoaded", function () {
  console.log("The Sour Boule site loaded.");

  const breadClubApp = document.getElementById("breadclub-app");
  if (!breadClubApp) {
    return;
  }

  const fullNameEl = document.getElementById("bc-full-name");
  const emailEl = document.getElementById("bc-email");
  const plainEl = document.getElementById("bc-plain");
  const rosemaryEl = document.getElementById("bc-rosemary");
  const jalapenoEl = document.getElementById("bc-jalapeno");
  const frequencyEl = document.getElementById("bc-frequency");
  const startDateEl = document.getElementById("bc-start-date");

  const pickupButtons = breadClubApp.querySelectorAll(".breadclub-darkpill");
  const nextPickupCardValue = breadClubApp.querySelector(".breadclub-next p:nth-of-type(2)");

  const previewMemberEl = breadClubApp.querySelector(".breadclub-note:nth-of-type(1) p:nth-of-type(1)");
  const previewEmailEl = breadClubApp.querySelector(".breadclub-note:nth-of-type(1) p:nth-of-type(2)");
  const previewDayEl = breadClubApp.querySelector(".breadclub-note:nth-of-type(1) p:nth-of-type(3)");
  const previewFrequencyEl = breadClubApp.querySelector(".breadclub-note:nth-of-type(1) p:nth-of-type(4)");
  const previewStartEl = breadClubApp.querySelector(".breadclub-note:nth-of-type(1) p:nth-of-type(5)");

  const selectedLoavesWrap = breadClubApp.querySelector(".breadclub-note:nth-of-type(2)");
  const totalLoavesBadge = selectedLoavesWrap.querySelector("span");

  const pricingWrap = breadClubApp.querySelector(".breadclub-note:nth-of-type(3)");
  const basePriceRow = pricingWrap.querySelector("p:nth-of-type(1) span");
  const weeklySavingsRow = pricingWrap.querySelector("p:nth-of-type(2) span");
  const estimatedChargeRow = pricingWrap.querySelector("p:nth-of-type(3) span");
  const summaryNoteRow = pricingWrap.querySelector("p:nth-of-type(4)");

  const breadData = [
    {
      key: "Plain Sourdough",
      price: 11,
      input: plainEl
    },
    {
      key: "Rosemary Garlic Sourdough",
      price: 11,
      input: rosemaryEl
    },
    {
      key: "Jalapeño Cheddar Sourdough",
      price: 13,
      input: jalapenoEl
    }
  ];

  const state = {
    pickupDay: "Thursday",
    frequency: frequencyEl ? frequencyEl.value : "Weekly"
  };

  function getSelectedPickupDay() {
    const activeButton = breadClubApp.querySelector(".breadclub-darkpill.active");
    return activeButton ? activeButton.textContent.trim() : "Thursday";
  }

  function getDayIndex(dayName) {
    if (dayName === "Sunday") return 0;
    if (dayName === "Monday") return 1;
    if (dayName === "Tuesday") return 2;
    if (dayName === "Wednesday") return 3;
    if (dayName === "Thursday") return 4;
    if (dayName === "Friday") return 5;
    return 6;
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  function addMonths(date, months) {
    const next = new Date(date);
    next.setMonth(next.getMonth() + months);
    return next;
  }

  function formatDate(date) {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }

  function getFirstEligiblePickupDate(dayName) {
    const now = new Date();
    const today = startOfDay(now);
    const targetDayIndex = getDayIndex(dayName);

    const candidate = new Date(today);
    const offset = (targetDayIndex - candidate.getDay() + 7) % 7;
    candidate.setDate(candidate.getDate() + offset);

    const cutoffDate = startOfDay(addDays(candidate, -3));

    if (today >= cutoffDate) {
      candidate.setDate(candidate.getDate() + 7);
    }

    return candidate;
  }

  function getStartDateOptions(dayName, frequency) {
    const firstEligible = getFirstEligiblePickupDate(dayName);
    const dates = [];

    for (let i = 0; i < 6; i += 1) {
      if (frequency === "Weekly") {
        dates.push(addDays(firstEligible, i * 7));
      } else if (frequency === "Every 2 Weeks") {
        dates.push(addDays(firstEligible, i * 14));
      } else {
        dates.push(addMonths(firstEligible, i));
      }
    }

    return dates;
  }

  function refreshStartDateOptions() {
    if (!startDateEl) return;

    const pickupDay = state.pickupDay;
    const frequency = state.frequency;
    const options = getStartDateOptions(pickupDay, frequency);
    const currentValue = startDateEl.value;

    startDateEl.innerHTML = "";

    options.forEach(function (dateObj, index) {
      const option = document.createElement("option");
      const label = formatDate(dateObj);
      option.value = label;
      option.textContent = label;

      if (currentValue && currentValue === label) {
        option.selected = true;
      } else if (!currentValue && index === 0) {
        option.selected = true;
      }

      startDateEl.appendChild(option);
    });

    const stillSelected = Array.from(startDateEl.options).some(function (option) {
      return option.selected;
    });

    if (!stillSelected && startDateEl.options.length > 0) {
      startDateEl.options[0].selected = true;
    }

    if (nextPickupCardValue) {
      nextPickupCardValue.textContent = startDateEl.value || "—";
    }
  }

  function getBreadSelections() {
    return breadData.map(function (bread) {
      return {
        name: bread.key,
        qty: Number(bread.input ? bread.input.value : 0),
        price: bread.price
      };
    });
  }

  function renderSelectedLoaves() {
    const selections = getBreadSelections().filter(function (item) {
      return item.qty > 0;
    });

    const existingRows = selectedLoavesWrap.querySelectorAll(".bc-selected-row, .bc-empty-row");
    existingRows.forEach(function (row) {
      row.remove();
    });

    const totalLoaves = selections.reduce(function (sum, item) {
      return sum + item.qty;
    }, 0);

    totalLoavesBadge.textContent = totalLoaves + " total";

    const weeklyDiscountPerLoaf = state.frequency === "Weekly" ? 0.25 : 0;

    if (selections.length === 0) {
      const emptyRow = document.createElement("p");
      emptyRow.className = "bc-empty-row";
      emptyRow.style.color = "#eadfc9";
      emptyRow.style.marginBottom = "0";
      emptyRow.textContent = "No loaves selected yet.";
      selectedLoavesWrap.appendChild(emptyRow);
      return {
        totalLoaves: 0,
        baseSubtotal: 0,
        discountTotal: 0,
        estimatedCharge: 0
      };
    }

    selections.forEach(function (item) {
      const row = document.createElement("p");
      row.className = "bc-selected-row";
      row.style.color = "#fff";
      row.style.marginBottom = "0";

      const lineTotal = (item.price - weeklyDiscountPerLoaf) * item.qty;
      row.innerHTML = item.name + " × " + item.qty + '<span style="float:right; font-weight:700;">$' + lineTotal.toFixed(2) + "</span>";
      selectedLoavesWrap.appendChild(row);
    });

    const baseSubtotal = selections.reduce(function (sum, item) {
      return sum + (item.price * item.qty);
    }, 0);

    const discountTotal = totalLoaves * weeklyDiscountPerLoaf;
    const estimatedCharge = baseSubtotal - discountTotal;

    return {
      totalLoaves: totalLoaves,
      baseSubtotal: baseSubtotal,
      discountTotal: discountTotal,
      estimatedCharge: estimatedCharge
    };
  }

  function updatePreview() {
    state.pickupDay = getSelectedPickupDay();
    state.frequency = frequencyEl ? frequencyEl.value : "Weekly";

    if (nextPickupCardValue) {
      nextPickupCardValue.textContent = startDateEl && startDateEl.value ? startDateEl.value : "—";
    }

    const memberName = fullNameEl && fullNameEl.value.trim() ? fullNameEl.value.trim() : "Your name here";
    const memberEmail = emailEl && emailEl.value.trim() ? emailEl.value.trim() : "your@email.com";
    const startDate = startDateEl && startDateEl.value ? startDateEl.value : "—";

    previewMemberEl.innerHTML = "<strong>Member:</strong> " + memberName;
    previewEmailEl.innerHTML = "<strong>Email:</strong> " + memberEmail;
    previewDayEl.innerHTML = "<strong>Pickup Day:</strong> " + state.pickupDay;
    previewFrequencyEl.innerHTML = "<strong>Frequency:</strong> " + state.frequency;
    previewStartEl.innerHTML = "<strong>Starts:</strong> " + startDate;

    const pricing = renderSelectedLoaves();

    basePriceRow.textContent = "$" + pricing.baseSubtotal.toFixed(2);

    if (pricing.discountTotal > 0) {
      weeklySavingsRow.textContent = "-$" + pricing.discountTotal.toFixed(2);
    } else {
      weeklySavingsRow.textContent = "$0.00";
    }

    estimatedChargeRow.textContent = "$" + pricing.estimatedCharge.toFixed(2);

    let repeatText = "every week";
    if (state.frequency === "Every 2 Weeks") {
      repeatText = "every 2 weeks";
    } else if (state.frequency === "Monthly") {
      repeatText = "every month";
    }

    summaryNoteRow.textContent =
      "This order will repeat " +
      repeatText +
      ". Weekly members save $0.25 per loaf. Changes close midnight 3 days before pickup. Example: Thursday pickup changes are due by Monday at 11:59 PM, and Sunday pickup changes are due by Thursday at 11:59 PM.";
  }

  if (pickupButtons.length) {
    pickupButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        pickupButtons.forEach(function (btn) {
          btn.classList.remove("active");
        });
        button.classList.add("active");
        state.pickupDay = button.textContent.trim();
        refreshStartDateOptions();
        updatePreview();
      });
    });
  }

  if (fullNameEl) {
    fullNameEl.addEventListener("input", updatePreview);
  }

  if (emailEl) {
    emailEl.addEventListener("input", updatePreview);
  }

  breadData.forEach(function (bread) {
    if (bread.input) {
      bread.input.addEventListener("change", updatePreview);
    }
  });

  if (frequencyEl) {
    frequencyEl.addEventListener("change", function () {
      state.frequency = frequencyEl.value;
      refreshStartDateOptions();
      updatePreview();
    });
  }

  if (startDateEl) {
    startDateEl.addEventListener("change", updatePreview);
  }

  state.pickupDay = getSelectedPickupDay();
  refreshStartDateOptions();
  updatePreview();
});
