import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";

const [, , platform, title, difficulty = "Easy", category = "General"] =
  process.argv;

const allowedDifficulties = new Set(["Easy", "Medium", "Hard", "Insane"]);

if (!platform || !title) {
  console.error(
    'Cách dùng: npm run new -- "Hack The Box" "Tên challenge" Easy Web',
  );
  process.exit(1);
}

if (!allowedDifficulties.has(difficulty)) {
  console.error("Độ khó phải là Easy, Medium, Hard hoặc Insane.");
  process.exit(1);
}

const slugify = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const platformSlug = slugify(platform);
const titleSlug = slugify(title);
const target = join(
  process.cwd(),
  "src",
  "content",
  "writeups",
  platformSlug,
  `${titleSlug}.md`,
);

if (existsSync(target)) {
  console.error(`File đã tồn tại: ${target}`);
  process.exit(1);
}

const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

const lines = [
  "---",
  `title: ${JSON.stringify(title)}`,
  'description: "Mô tả ngắn kết quả và kỹ thuật chính của challenge."',
  `platform: ${JSON.stringify(platform)}`,
  `category: ${JSON.stringify(category)}`,
  `difficulty: ${JSON.stringify(difficulty)}`,
  `publishedAt: ${today}`,
  'tags: ["tag-1", "tag-2"]',
  "draft: true",
  "featured: false",
  "---",
  "",
  "## Tóm tắt",
  "",
  "Mục tiêu, kết quả và kỹ thuật chính.",
  "",
  "## Recon",
  "",
  "```bash",
  "# Command và output quan trọng",
  "```",
  "",
  "## Phân tích",
  "",
  "Tách rõ quan sát, giả thuyết và bước kiểm chứng.",
  "",
  "## Khai thác",
  "",
  "```python",
  "# solve.py",
  "```",
  "",
  "## Flag",
  "",
  "Ẩn flag nếu điều lệ của giải chưa cho phép public.",
  "",
  "## Bài học",
  "",
  "- Điều gì đã hiệu quả?",
  "- Hướng nào đã thất bại?",
  "- Có thể phòng thủ như thế nào?",
  "",
];

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, lines.join("\n"), "utf8");
console.log(`Đã tạo: ${target}`);
