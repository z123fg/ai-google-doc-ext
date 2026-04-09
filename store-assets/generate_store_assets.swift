import AppKit
import Foundation

struct Palette {
    static let green = NSColor(calibratedRed: 0.20, green: 0.66, blue: 0.33, alpha: 1)
    static let greenDark = NSColor(calibratedRed: 0.11, green: 0.47, blue: 0.23, alpha: 1)
    static let mint = NSColor(calibratedRed: 0.87, green: 0.96, blue: 0.90, alpha: 1)
    static let text = NSColor(calibratedRed: 0.12, green: 0.14, blue: 0.16, alpha: 1)
    static let subtext = NSColor(calibratedRed: 0.40, green: 0.43, blue: 0.46, alpha: 1)
    static let panel = NSColor(calibratedRed: 0.97, green: 0.98, blue: 0.97, alpha: 1)
    static let page = NSColor.white
    static let pageAlt = NSColor(calibratedRed: 0.95, green: 0.97, blue: 0.96, alpha: 1)
    static let blue = NSColor(calibratedRed: 0.20, green: 0.50, blue: 0.95, alpha: 1)
    static let yellow = NSColor(calibratedRed: 0.98, green: 0.82, blue: 0.28, alpha: 1)
}

extension NSBezierPath {
    convenience init(roundedRect rect: NSRect, radius: CGFloat) {
        self.init(roundedRect: rect, xRadius: radius, yRadius: radius)
    }
}

func fill(_ rect: NSRect, color: NSColor, radius: CGFloat = 0) {
    color.setFill()
    if radius > 0 {
        NSBezierPath(roundedRect: rect, radius: radius).fill()
    } else {
        NSBezierPath(rect: rect).fill()
    }
}

func stroke(_ rect: NSRect, color: NSColor, lineWidth: CGFloat = 1, radius: CGFloat = 0) {
    color.setStroke()
    let path = radius > 0 ? NSBezierPath(roundedRect: rect, radius: radius) : NSBezierPath(rect: rect)
    path.lineWidth = lineWidth
    path.stroke()
}

func drawText(_ text: String, in rect: NSRect, fontSize: CGFloat, weight: NSFont.Weight = .regular, color: NSColor = Palette.text, alignment: NSTextAlignment = .left) {
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = alignment
    paragraph.lineBreakMode = .byWordWrapping
    let font = NSFont.systemFont(ofSize: fontSize, weight: weight)
    let attrs: [NSAttributedString.Key: Any] = [
        .font: font,
        .foregroundColor: color,
        .paragraphStyle: paragraph,
    ]
    (text as NSString).draw(with: rect, options: [.usesLineFragmentOrigin, .usesFontLeading], attributes: attrs)
}

func drawCenteredText(_ text: String, in rect: NSRect, fontSize: CGFloat, weight: NSFont.Weight = .regular, color: NSColor = Palette.text) {
    drawText(text, in: rect, fontSize: fontSize, weight: weight, color: color, alignment: .center)
}

func drawBulletLines(_ lines: [String], startX: CGFloat, startY: CGFloat, width: CGFloat, lineHeight: CGFloat, fontSize: CGFloat, color: NSColor = Palette.text) {
    for (index, line) in lines.enumerated() {
        let y = startY - CGFloat(index) * lineHeight
        fill(NSRect(x: startX, y: y + 8, width: 8, height: 8), color: Palette.green, radius: 4)
        drawText(line, in: NSRect(x: startX + 18, y: y, width: width - 18, height: lineHeight + 10), fontSize: fontSize, weight: .medium, color: color)
    }
}

func drawMagnifier(center: CGPoint, radius: CGFloat, lineWidth: CGFloat, color: NSColor) {
    color.setStroke()
    let circle = NSBezierPath()
    circle.lineWidth = lineWidth
    circle.appendArc(withCenter: center, radius: radius, startAngle: 0, endAngle: 360)
    circle.stroke()

    let handle = NSBezierPath()
    handle.lineWidth = lineWidth
    handle.lineCapStyle = .round
    handle.move(to: CGPoint(x: center.x + radius * 0.68, y: center.y - radius * 0.68))
    handle.line(to: CGPoint(x: center.x + radius * 1.55, y: center.y - radius * 1.55))
    handle.stroke()
}

func drawIcon(at rect: NSRect) {
    fill(rect, color: Palette.green, radius: rect.width * 0.2)

    let sheet = NSRect(x: rect.minX + rect.width * 0.22, y: rect.minY + rect.height * 0.18, width: rect.width * 0.46, height: rect.height * 0.62)
    fill(sheet, color: .white, radius: rect.width * 0.08)

    let fold = NSBezierPath()
    let fx = sheet.maxX - rect.width * 0.12
    let fy = sheet.maxY
    fold.move(to: CGPoint(x: fx, y: fy))
    fold.line(to: CGPoint(x: sheet.maxX, y: fy - rect.width * 0.12))
    fold.line(to: CGPoint(x: sheet.maxX, y: fy))
    fold.close()
    Palette.mint.setFill()
    fold.fill()

    for i in 0..<3 {
        fill(NSRect(x: sheet.minX + rect.width * 0.08, y: sheet.maxY - rect.width * (0.18 + CGFloat(i) * 0.12), width: rect.width * 0.22, height: rect.width * 0.04), color: Palette.green, radius: rect.width * 0.02)
    }

    drawMagnifier(center: CGPoint(x: rect.maxX - rect.width * 0.30, y: rect.minY + rect.height * 0.34), radius: rect.width * 0.14, lineWidth: rect.width * 0.05, color: .white)
}

func drawSearchRow(x: CGFloat, y: CGFloat, width: CGFloat, title: String, score: String) {
    fill(NSRect(x: x, y: y, width: width, height: 52), color: .white, radius: 14)
    drawText(score, in: NSRect(x: x + 14, y: y + 28, width: 42, height: 16), fontSize: 12, weight: .bold, color: Palette.green)
    drawText(title, in: NSRect(x: x + 58, y: y + 12, width: width - 72, height: 30), fontSize: 13, weight: .medium, color: Palette.text)
}

func drawSidebarMockup(in rect: NSRect) {
    fill(rect, color: .white, radius: 24)
    fill(NSRect(x: rect.minX, y: rect.minY, width: 8, height: rect.height), color: Palette.green)
    drawText("AI Search Engine", in: NSRect(x: rect.minX + 20, y: rect.maxY - 36, width: rect.width - 40, height: 20), fontSize: 16, weight: .bold, color: Palette.green)

    let config = NSRect(x: rect.minX + 18, y: rect.maxY - 118, width: rect.width - 36, height: 76)
    fill(config, color: Palette.panel, radius: 14)
    drawText("Config", in: NSRect(x: config.minX + 14, y: config.maxY - 26, width: 120, height: 18), fontSize: 11, weight: .semibold, color: Palette.subtext)
    fill(NSRect(x: config.minX + 14, y: config.minY + 16, width: config.width - 28, height: 8), color: Palette.mint, radius: 4)
    fill(NSRect(x: config.minX + 14, y: config.minY + 16, width: config.width * 0.72, height: 8), color: Palette.green, radius: 4)

    let preview = NSRect(x: rect.minX + 18, y: rect.maxY - 188, width: rect.width - 36, height: 44)
    fill(preview, color: Palette.pageAlt, radius: 12)
    drawText("node.js interview exp", in: NSRect(x: preview.minX + 12, y: preview.minY + 12, width: preview.width - 24, height: 20), fontSize: 14, weight: .medium, color: Palette.text)

    fill(NSRect(x: rect.minX + 18, y: rect.maxY - 202, width: rect.width - 36, height: 4), color: Palette.yellow, radius: 2)

    let startY = rect.maxY - 274
    drawSearchRow(x: rect.minX + 18, y: startY, width: rect.width - 36, title: "[node js exp]: real project answer", score: "[71%]")
    drawSearchRow(x: rect.minX + 18, y: startY - 64, width: rect.width - 36, title: "[do you know node.js]: definition and trade-off", score: "[70%]")
    drawSearchRow(x: rect.minX + 18, y: startY - 128, width: rect.width - 36, title: "[diff callback and promise]: compare style", score: "[65%]")
}

func drawDocPage(in rect: NSRect) {
    fill(rect, color: Palette.page, radius: 24)
    fill(NSRect(x: rect.minX, y: rect.maxY - 56, width: rect.width, height: 56), color: Palette.pageAlt, radius: 24)
    drawText("Interview Notes", in: NSRect(x: rect.minX + 24, y: rect.maxY - 38, width: 220, height: 24), fontSize: 22, weight: .bold, color: Palette.text)

    drawText("How does Node.js handle async task?", in: NSRect(x: rect.minX + 28, y: rect.maxY - 142, width: rect.width - 56, height: 64), fontSize: 28, weight: .bold, color: Palette.text)

    let lines = [
        "JavaScript runs on one main thread per Node runtime",
        "libuv manages the event loop and async work",
        "Callbacks return through the task queue on the main thread",
    ]
    drawBulletLines(lines, startX: rect.minX + 32, startY: rect.maxY - 214, width: rect.width - 80, lineHeight: 38, fontSize: 18)

    let insertCard = NSRect(x: rect.minX + 26, y: rect.minY + 38, width: rect.width - 52, height: 116)
    fill(insertCard, color: Palette.mint, radius: 18)
    drawText("Write-back preview", in: NSRect(x: insertCard.minX + 18, y: insertCard.maxY - 30, width: 180, height: 18), fontSize: 12, weight: .bold, color: Palette.greenDark)
    drawText("Node.js uses a single main JS thread, while libuv and the OS handle async work without blocking the UI.", in: NSRect(x: insertCard.minX + 18, y: insertCard.minY + 22, width: insertCard.width - 36, height: 56), fontSize: 18, weight: .medium, color: Palette.text)
    fill(NSRect(x: insertCard.maxX - 132, y: insertCard.minY + 18, width: 112, height: 34), color: Palette.green, radius: 17)
    drawCenteredText("Insert answer", in: NSRect(x: insertCard.maxX - 132, y: insertCard.minY + 25, width: 112, height: 18), fontSize: 14, weight: .bold, color: .white)
}


func drawSmallPromo(size: NSSize, filename: String) throws {
    let image = NSImage(size: size)
    image.lockFocus()
    let fullRect = NSRect(origin: .zero, size: size)
    fill(fullRect, color: NSColor(calibratedRed: 0.95, green: 0.98, blue: 0.96, alpha: 1))

    let glow = NSBezierPath(ovalIn: NSRect(x: -40, y: -30, width: 180, height: 180))
    NSColor(calibratedRed: 0.84, green: 0.91, blue: 0.99, alpha: 0.45).setFill()
    glow.fill()

    fill(NSRect(x: 22, y: size.height - 72, width: 116, height: 28), color: .white, radius: 14)
    drawText("Chrome extension", in: NSRect(x: 34, y: size.height - 65, width: 98, height: 14), fontSize: 11, weight: .bold, color: Palette.greenDark)

    drawText("Search notes\nin Docs", in: NSRect(x: 24, y: 162, width: 170, height: 74), fontSize: 20, weight: .bold, color: Palette.text)
    drawText("Local AI search and\none-click write-back.", in: NSRect(x: 24, y: 116, width: 150, height: 42), fontSize: 11.5, weight: .medium, color: Palette.subtext)

    fill(NSRect(x: 24, y: 34, width: 116, height: 34), color: Palette.green, radius: 17)
    drawCenteredText("Local search", in: NSRect(x: 24, y: 43, width: 116, height: 16), fontSize: 12, weight: .bold, color: .white)

    let iconRect = NSRect(x: 248, y: 122, width: 120, height: 120)
    drawIcon(at: iconRect)

    let miniCard = NSRect(x: 190, y: 30, width: 220, height: 140)
    fill(miniCard, color: .white, radius: 22)
    fill(NSRect(x: miniCard.minX, y: miniCard.minY, width: 6, height: miniCard.height), color: Palette.green)
    drawText("AI Search", in: NSRect(x: miniCard.minX + 16, y: miniCard.maxY - 28, width: 120, height: 16), fontSize: 13, weight: .bold, color: Palette.green)
    fill(NSRect(x: miniCard.minX + 16, y: miniCard.maxY - 54, width: miniCard.width - 32, height: 24), color: Palette.pageAlt, radius: 12)
    drawText("node.js interview", in: NSRect(x: miniCard.minX + 28, y: miniCard.maxY - 48, width: 150, height: 12), fontSize: 11, weight: .medium, color: Palette.text)
    fill(NSRect(x: miniCard.minX + 16, y: miniCard.minY + 24, width: miniCard.width - 32, height: 40), color: Palette.mint, radius: 14)
    drawText("Insert answer", in: NSRect(x: miniCard.minX + 28, y: miniCard.minY + 36, width: 100, height: 14), fontSize: 12, weight: .bold, color: Palette.greenDark)

    image.unlockFocus()
    try save(image: image, to: filename)
}

func drawHeroCanvas(size: NSSize, title: String, subtitle: String, filename: String, showBadge: Bool = true) throws {
    let image = NSImage(size: size)
    image.lockFocus()

    let fullRect = NSRect(origin: .zero, size: size)
    fill(fullRect, color: NSColor(calibratedRed: 0.94, green: 0.98, blue: 0.95, alpha: 1))

    let glow1 = NSBezierPath(ovalIn: NSRect(x: size.width * 0.60, y: size.height * 0.50, width: size.width * 0.34, height: size.width * 0.34))
    NSColor(calibratedRed: 0.77, green: 0.93, blue: 0.81, alpha: 0.55).setFill()
    glow1.fill()
    let glow2 = NSBezierPath(ovalIn: NSRect(x: -size.width * 0.08, y: -size.height * 0.05, width: size.width * 0.42, height: size.width * 0.42))
    NSColor(calibratedRed: 0.82, green: 0.90, blue: 1.0, alpha: 0.35).setFill()
    glow2.fill()

    if showBadge {
        fill(NSRect(x: 44, y: size.height - 84, width: 188, height: 34), color: .white, radius: 17)
        drawText("Chrome extension for Docs", in: NSRect(x: 60, y: size.height - 75, width: 160, height: 18), fontSize: 13, weight: .bold, color: Palette.greenDark)
    }

    let isSmall = size.width <= 500
    let titleRect = isSmall ? NSRect(x: 24, y: size.height * 0.56, width: size.width * 0.34, height: 120) : NSRect(x: 44, y: size.height * 0.54, width: size.width * 0.32, height: 150)
    let subtitleRect = isSmall ? NSRect(x: 24, y: size.height * 0.43, width: size.width * 0.32, height: 60) : NSRect(x: 48, y: size.height * 0.42, width: size.width * 0.30, height: 70)
    drawText(title, in: titleRect, fontSize: isSmall ? 19 : 36, weight: .bold, color: Palette.text)
    drawText(subtitle, in: subtitleRect, fontSize: isSmall ? 10.5 : 18, weight: .medium, color: Palette.subtext)

    let chipY = isSmall ? size.height * 0.28 : size.height * 0.27
    fill(NSRect(x: isSmall ? 24 : 48, y: chipY, width: isSmall ? 116 : 164, height: isSmall ? 34 : 42), color: Palette.green, radius: isSmall ? 17 : 21)
    drawCenteredText("Local search", in: NSRect(x: isSmall ? 24 : 48, y: chipY + (isSmall ? 9 : 11), width: isSmall ? 116 : 164, height: 20), fontSize: isSmall ? 12 : 16, weight: .bold, color: .white)
    fill(NSRect(x: isSmall ? 146 : 226, y: chipY, width: isSmall ? 108 : 138, height: isSmall ? 34 : 42), color: .white, radius: isSmall ? 17 : 21)
    drawCenteredText("Write-back", in: NSRect(x: isSmall ? 146 : 226, y: chipY + (isSmall ? 9 : 11), width: isSmall ? 108 : 138, height: 20), fontSize: isSmall ? 12 : 16, weight: .bold, color: Palette.greenDark)

    let docRect = isSmall ? NSRect(x: size.width * 0.48, y: size.height * 0.12, width: size.width * 0.33, height: size.height * 0.70) : NSRect(x: size.width * 0.43, y: size.height * 0.11, width: size.width * 0.31, height: size.height * 0.74)
    let sidebarRect = isSmall ? NSRect(x: size.width * 0.74, y: size.height * 0.18, width: size.width * 0.19, height: size.height * 0.60) : NSRect(x: size.width * 0.71, y: size.height * 0.17, width: size.width * 0.23, height: size.height * 0.66)
    drawDocPage(in: docRect)
    drawSidebarMockup(in: sidebarRect)

    image.unlockFocus()
    try save(image: image, to: filename)
}

func drawScreenshot(size: NSSize, filename: String) throws {
    let image = NSImage(size: size)
    image.lockFocus()
    let fullRect = NSRect(origin: .zero, size: size)
    fill(fullRect, color: Palette.pageAlt)

    fill(NSRect(x: 26, y: 20, width: size.width - 52, height: size.height - 40), color: NSColor(calibratedWhite: 0.92, alpha: 1), radius: 26)
    fill(NSRect(x: 48, y: 42, width: size.width - 96, height: size.height - 84), color: .white, radius: 22)

    let docRect = NSRect(x: 78, y: 86, width: 740, height: 628)
    let sidebarRect = NSRect(x: 850, y: 106, width: 340, height: 588)
    drawDocPage(in: docRect)
    drawSidebarMockup(in: sidebarRect)

    fill(NSRect(x: 874, y: 632, width: 292, height: 28), color: Palette.green, radius: 14)
    drawCenteredText("Search while you type", in: NSRect(x: 874, y: 639, width: 292, height: 16), fontSize: 13, weight: .bold, color: .white)

    image.unlockFocus()
    try save(image: image, to: filename)
}

func save(image: NSImage, to filename: String) throws {
    let ext = URL(fileURLWithPath: filename).pathExtension.lowercased()
    guard let tiff = image.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff) else {
        throw NSError(domain: "asset", code: 1)
    }

    let data: Data?
    if ext == "jpg" || ext == "jpeg" {
        data = rep.representation(using: .jpeg, properties: [.compressionFactor: 0.92])
    } else {
        data = rep.representation(using: .png, properties: [:])
    }

    guard let out = data else { throw NSError(domain: "asset", code: 2) }
    try out.write(to: URL(fileURLWithPath: filename))
}

let outputDir = URL(fileURLWithPath: FileManager.default.currentDirectoryPath).appendingPathComponent("store-assets/generated")
try? FileManager.default.createDirectory(at: outputDir, withIntermediateDirectories: true)

let iconImage = NSImage(size: NSSize(width: 128, height: 128))
iconImage.lockFocus()
drawIcon(at: NSRect(x: 0, y: 0, width: 128, height: 128))
iconImage.unlockFocus()
try save(image: iconImage, to: outputDir.appendingPathComponent("store-icon-128.png").path)

try drawScreenshot(size: NSSize(width: 1280, height: 800), filename: outputDir.appendingPathComponent("screenshot-1-1280x800.png").path)
try drawSmallPromo(size: NSSize(width: 440, height: 280), filename: outputDir.appendingPathComponent("small-promo-440x280.png").path)
try drawHeroCanvas(size: NSSize(width: 1400, height: 560), title: "Search your notes while you type", subtitle: "Local AI sidebar for Google Docs with fast retrieval and write-back.", filename: outputDir.appendingPathComponent("marquee-promo-1400x560.png").path)

print(outputDir.path)
