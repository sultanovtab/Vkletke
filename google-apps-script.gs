const TELEGRAM_BOT_TOKEN = "ТВОЙ_ТОКЕН_БОТА"; 
const ADMIN_CHAT_ID = "ТВОЙ_CHAT_ID";        
const ADMIN_PASSWORD = "1234";                
// Ссылка на файл с правилами на GitHub (можно заменить на любую прямую ссылку на PDF/картинку/TXT)
const RULES_FILE_URL = "https://raw.githubusercontent.com/sultanovtab/Vkletke/refs/heads/main/rules.pdf"; 

function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Bookings");
    
    if (!sheet) {
      sheet = ss.insertSheet("Bookings");
      sheet.appendRow(["ID", "Дата создания", "Квест", "Дата квеста", "Время", "Имя", "Телефон", "Кол-во чел", "TG ID", "TG Профиль", "Статус"]);
    }
    
    var data = JSON.parse(e.postData.contents);

    // 1. ПРОВЕРКА ПАРОЛЯ АДМИНА
    if (data.action === "verifyAdmin") {
      if (data.password === ADMIN_PASSWORD) {
        return ContentService.createTextOutput(JSON.stringify({"status": "success"}))
                              .setMimeType(ContentService.MimeType.JSON);
      } else {
        return ContentService.createTextOutput(JSON.stringify({"status": "error"}))
                              .setMimeType(ContentService.MimeType.JSON);
      }
    }

    // 2. ИЗМЕНЕНИЕ СТАТУСА АДМИНОМ (+ отправка уведомления клиенту)
    if (data.action === "updateStatus") {
      if (data.password !== ADMIN_PASSWORD) return ContentService.createTextOutput("error");

      var rows = sheet.getDataRange().getValues();
      var targetRow = -1;
      var clientTgId = "";
      var questName = "";
      var questDate = "";
      var questTime = "";

      for (var i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === String(data.bookingId)) {
          targetRow = i + 1;
          questName = String(rows[i][2]).replace(/^'/, '');
          questDate = String(rows[i][3]).replace(/^'/, '');
          questTime = String(rows[i][4]).replace(/^'/, '');
          
          // Получаем TG ID из 9-й колонки (индекс 8)
          clientTgId = String(rows[i][8] || '').replace(/^'/, '').trim();
          
          break;
        }
      }

      if (targetRow !== -1) {
        sheet.getRange(targetRow, 11).setValue("'" + data.newStatus);
        
        // Если заявку приняли и у нас есть ID клиента — шлем сообщение через бота
        if (data.newStatus === "Подтверждено" && clientTgId) {
          sendClientApprovalMessage(clientTgId, questName, questDate, questTime);
        }

        return ContentService.createTextOutput(JSON.stringify({"status": "success"}))
                              .setMimeType(ContentService.MimeType.JSON);
      }
      return ContentService.createTextOutput("error");
    }

    // 3. СОЗДАНИЕ БРОНИ
    var quest = String(data.quest || '').trim();
    var date = String(data.date || '').trim();
    var time = String(data.time || '').trim();
    var name = String(data.name || '').trim();
    var phone = String(data.phone || '').trim();
    var people = String(data.people || '').trim();
    
    var tgUsername = String(data.tgUsername || '').trim();
    var tgId = String(data.tgId || '').trim();

    var bookingId = "B" + new Date().getTime();
    var status = "Ожидает";

    // Сохраняем TG ID отдельно в колонку 9 (индекс 8)
    // А в колонку 10 (индекс 9) - ссылку для удобства админа

    // Формируем ссылку для админа
    var tableTgLink = "Нет данных";
    if (tgUsername) {
      tableTgLink = '=HYPERLINK("https://t.me/' + tgUsername.replace('@', '') + '"; "' + tgUsername + '")';
    } else if (tgId) {
      tableTgLink = "ID: " + tgId;
    }

    sheet.appendRow([
      "'" + bookingId,
      "'" + new Date().toLocaleString("ru-RU"),
      "'" + quest,
      "'" + date,
      "'" + time,
      "'" + name,
      "'" + phone,
      "'" + people,
      "'" + tgId,                    // Колонка 9: Чистый TG ID (для бота)
      "'" + tableTgLink,             // Колонка 10: Красивая ссылка (для админа)
      "'" + status
    ]);

    // Уведомление админу в чат
    if (TELEGRAM_BOT_TOKEN && ADMIN_CHAT_ID) {
      var adminLink = tgUsername ? "https://t.me/" + tgUsername.replace('@', '') : (tgId ? "tg://user?id=" + tgId : "");
      var adminUserText = adminLink ? "[" + name + "](" + adminLink + ")" : name;
      
      var message = "🚨 *НОВАЯ ЗАЯВКА НА БРОНЬ!*\n\n" +
                    "🎭 *Квест:* " + quest + "\n" +
                    "📅 *Дата:* " + date + " в " + time + "\n" +
                    "👥 *Игроков:* " + people + " чел.\n" +
                    "👤 *Клиент:* " + adminUserText + "\n" +
                    "📞 *Тел:* " + phone;
      sendTelegramNotice(ADMIN_CHAT_ID, message);
    }
    
    return ContentService.createTextOutput(JSON.stringify({"status": "success", "id": bookingId, "tgId": tgId}))
                          .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log("Ошибка в doPost: " + error);
    return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": error.toString()}))
                          .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Bookings");
    if (!sheet) return ContentService.createTextOutput("[]").setMimeType(ContentService.MimeType.JSON);
    
    var rows = sheet.getDataRange().getValues();
    if (rows.length <= 1) return ContentService.createTextOutput("[]").setMimeType(ContentService.MimeType.JSON);
    
    var bookings = [];
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][2]) {
        var rawDate = rows[i][3];
        var displayDate = (rawDate instanceof Date) ? rawDate.toLocaleDateString('ru-RU') : String(rawDate || '').replace(/^'/, '');
        var rawTime = rows[i][4];
        var displayTime = (rawTime instanceof Date) ? rawTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : String(rawTime || '').replace(/^'/, '');

        // Теперь тgId берем из колонки 9 (индекс 8)
        var tgId = String(rows[i][8] || '').replace(/^'/, '');

        bookings.push({
          id: String(rows[i][0] || '').replace(/^'/, ''),
          quest: String(rows[i][2] || '').replace(/^'/, ''),
          date: displayDate,
          time: displayTime,
          name: String(rows[i][5] || ''),
          phone: String(rows[i][6] || '').replace(/^'/, ''),
          people: String(rows[i][7] || ''),
          tgId: tgId,                                              // Чистый ID для отправки боту
          tgContact: String(rows[i][9] || '').replace(/^'/, ''),  // Красивая ссылка для админа
          status: String(rows[i][10] || 'Ожидает').replace(/^'/, '')
        });
      }
    }
    return ContentService.createTextOutput(JSON.stringify(bookings)).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log("Ошибка в doGet: " + error);
    return ContentService.createTextOutput("[]").setMimeType(ContentService.MimeType.JSON);
  }
}

// Отправка текстовых уведомлений
function sendTelegramNotice(chatId, text) {
  try {
    var url = "https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendMessage";
    var options = {
      "method": "post",
      "contentType": "application/json",
      "payload": JSON.stringify({"chat_id": chatId, "text": text, "parse_mode": "Markdown"}),
      "muteHttpExceptions": true
    };
    var response = UrlFetchApp.fetch(url, options);
    Logger.log("sendTelegramNotice response: " + response.getContentText());
  } catch(e) {
    Logger.log("Ошибка sendTelegramNotice: " + e);
  }
}

// Функция отправки подтверждения и файла правил клиенту
function sendClientApprovalMessage(chatId, quest, date, time) {
  try {
    var text = "🎉 *Ваша заявка принята администратором!*\n\n" +
               "Мы ждем вас на квест *«" + quest + "»*:\n" +
               "📅 *Дата:* " + date + "\n" +
               "⏰ *Время:* " + time + "\n\n" +
               "Пожалуйста, ознакомьтесь с правилами квеста в приложенном файле ниже. До встречи!";
    
    // Сначала шлем текст
    sendTelegramNotice(chatId, text);

    // Затем отправляем документ (файл с правилами с GitHub)
    try {
      var docUrl = "https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendDocument";
      var options = {
        "method": "post",
        "contentType": "application/json",
        "payload": JSON.stringify({
          "chat_id": chatId,
          "document": RULES_FILE_URL,
          "caption": "📄 Официальные правила квеста «В Клетке»"
        }),
        "muteHttpExceptions": true
      };
      var response = UrlFetchApp.fetch(docUrl, options);
      Logger.log("sendClientApprovalMessage response: " + response.getContentText());
    } catch(e) {
      Logger.log("Ошибка отправки файла: " + e);
      // Если файл не найдет по ссылке, ничего страшного, текст клиенту всё равно уйдет
    }
  } catch(e) {
    Logger.log("Ошибка sendClientApprovalMessage: " + e);
  }
}
