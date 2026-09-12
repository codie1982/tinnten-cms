# CMS AI Model Kataloğu

Route: `/cms/ai-models`. Menü ve RoleGuard yalnız `cms:admin` rolüne açıktır.
Firma AI izinleri CMS katalog yazma hakkı vermez. BE tekrar platform rolünü
doğrular. Mevcut CMS API istemcisi ve oturum akışı kullanılır.

Ekran: merkezi model listesi/arama/cursor, global model taslağı, rol ve bağlantı
türü seçimi, yayın/pasifleştirme, ayrı sağlayıcı tahmini/Tinnten tarifesi fiyat
sürümü formu. Fiyatlar decimal string, unit million_tokens, currency USD.
Yayın/pasifleştirme onay ister; geçmiş kayıtlar silinmez. Tahakkuk tarifesinde
creditPerUsd ayrıca girilir. Sağlayıcı tahmini bu kredi oranını taşımaz.

BE `contracts/ai-infrastructure.v1.json` kaynağının bu repoda sürümlü kopyası
vardır. Başlangıçta `/cms/ai/context` catalog availability=false döndürür;
GET models 501, yazma endpoint'leri henüz mount edilmemiştir. Ekran kayıt
ve yayınlama düğmelerini açmaz, örnek fiyat/model veya sahte başarı üretmez.

Kontrol: `node scripts/check-ai-catalog.mjs` sözleşmeyi ve yeni JSX/import
dosyalarını ESLint ile kontrol eder. Bu tarayıcı/e2e testi değildir.
Canlı testte API ve auth yalnız ayrı test ortamına ayarlanmalıdır; production
veya varsayılan localhost:5001'in test olduğu varsayılmamalıdır.
