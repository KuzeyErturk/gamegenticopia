# Vibe Control District — Oyun Rehberi / Game Guide

Bu dosya Vibe Control District’in mevcut prototipinin nasıl çalıştığını açıklar.

This document explains how the current Vibe Control District prototype works.

---

# Türkçe

## Oyunun ana fikri

Vibe Control District, AI ajanlarının yaptığı kod değişikliklerini bir köy kurma oyununa dönüştürür.

Temel akış şöyledir:

```text
AI ajanı kod üzerinde çalışır
            ↓
Oyundaki işçi bir köy projesine gider
            ↓
Ajan çalışmayı durdurduğunda bir soru açılır
            ↓
Oyuncu kod değişikliğini doğru açıklar
            ↓
İnşaat ilerler veya bina seviye atlar
```

Kod değişikliği oyunda bir **iş emrine** dönüşür. Oyuncu, bu iş emrinin köyde hangi binayı geliştireceğini seçer. AI ajanı işi yapar; oyuncunun kodu anlaması inşaatı tamamlar.

## James, Ben, Ollie, Luc ve Miguel kim?

Bunlar köydeki beş seçilebilir işçidir. Codex, Claude veya terminal yalnızca iş emrinin nereden geldiğini belirtir; görevi hangi kişinin üstleneceğine oyuncu karar verir. Boşta olan herhangi bir işçi, uygun herhangi bir binaya gönderilebilir.

## Atanmamış iş emri ne demek?

Atanmamış iş emri için henüz bir kişi ve köy projesi seçilmemiştir.

Bir işçiyi atamak için:

1. Sağ panelde iş emrine bas.
2. James, Ben, Ollie, Luc veya Miguel arasından boşta olan birini seç.
3. **Choose village project** butonuna bas.
4. Haritadaki uygun binalar ve inşaat alanları vurgulanır.
5. Geliştirmek istediğin bina veya blueprint’e bas.
6. Seçilen işçi Builders’ Guild’den çıkar, mevcut yol ağını takip ederek alana yürür ve çalışmaya başlar.
7. Çalışma durduğunda bir anlama sorusu açılır.

Aynı anda bir binada yalnızca bir aktif işçi çalışabilir.

## Başlangıç görevleri

### James — Password recovery

James, başlangıçta şifre sıfırlama özelliği üzerinde çalışır. Bu görev iki aşamalıdır:

1. Şifre sıfırlama isteği
2. Reset token güvenliği

James’in ilk sorusu oyun başladığında hazırdır. İlk soruyu doğru cevapladığında yeniden çalışır. Birkaç saniye sonra ikinci soru açılır. İkinci soru da doğru cevaplanırsa seçilen bina seviye atlar.

### Ben — Product search

Ben, on dosyalık daha büyük bir arama özelliği üzerinde çalışır. Bu nedenle görev tek sorudan oluşmaz.

Görevin dört aşaması vardır:

1. Filtre davranışı
2. Arama isteklerinin zamanlaması
3. Eski arama sonuçlarının yeni sonuçları ezmesini engelleme
4. Genel sürüm kontrolü

Her doğru cevap bir inşaat aşamasını tamamlar. Ben daha sonra çalışmaya devam eder ve bir sonraki aşamanın sorusu açılır.

### Atanmamış örnek — Deployment history

Bu görev başlangıçta bir kişiye veya binaya atanmamıştır. Önce beş işçiden boşta olan birini, ardından mevcut bir binayı veya Shop’tan aldığın yeni bir blueprint’i seçebilirsin.

## Sorular nasıl çalışır?

Soru ekranı, cevap vermek için bakman gereken ilgili dosya parçalarını da gösterir. Eklenen satırlar `+`, silinen satırlar `−` ile işaretlenir. Böylece cevabı tahmin etmek yerine değişikliği inceleyebilirsin. Örnek görevler temsili diff’ler, yerel watcher tarafından oluşturulan görevler ise gerçek `git diff` verisini kullanır.

Her soruda üç seçenek bulunur:

- A
- B
- C

Doğru cevap verirsen:

- İnşaat aşaması tamamlanır.
- XP kazanırsın.
- Coin kazanırsın.
- Streak artar.
- Son aşamadaysan bina tamamlanır veya seviye atlar.

Yanlış cevap verirsen:

- İnşaat tamamlanmaz.
- Streak sıfırlanır.
- Oyun küçük bir ipucu verir.
- Tekrar deneyebilirsin.

Yanlış cevap verdiğinde bina, XP veya coin kaybetmezsin.

## Knowledge seviyeleri

Sağ üstte üç farklı bilgi seviyesi bulunur.

### Beginner

Kod değişikliğinin kullanıcıya ne kazandırdığını sorar.

Örnek:

> Bu değişiklik kullanıcıya ne yaptırıyor?

### Builder

Kodun neden belirli bir şekilde yazıldığını sorar.

Örnek:

> Arama neden 300 milisaniye bekliyor?

### Expert

Güvenlik, veri bütünlüğü, zamanlama problemleri ve teknik riskleri sorar.

Örnek:

> Reset token neden veritabanında hash olarak tutuluyor?

Knowledge seviyesini oyun sırasında istediğin zaman değiştirebilirsin.

## Büyük kod değişiklikleri nasıl yönetilir?

Büyük bir görev yalnızca dosya sayısına göre değerlendirilmez. Değişiklikler mantıksal sorumluluklarına göre gruplandırılır.

Örneğin on dosyalık bir özellik şu aşamalara ayrılabilir:

```text
Temel davranış → İstek zamanlaması → Güvenlik → Genel kontrol
```

Küçük bir değişiklik tek soru gerektirebilir. Büyük veya riskli bir değişiklik üç ya da dört farklı inşaat aşamasına sahip olabilir.

## Shop nasıl çalışır?

Shop’taki sayılar ürünlerin **coin fiyatlarıdır**.

| Ürün | Fiyat |
|---|---:|
| Apple Tree | 15 coin |
| Park Bench | 18 coin |
| Village Lamp | 22 coin |
| Stone Fountain | 45 coin |
| Garden Cottage | 55 coin |
| Village Bakery | 80 coin |
| Tiny Library | 95 coin |

Bir ürünü satın aldığında ürün doğrudan haritaya yerleşmez. Önce **Inventory** bölümüne gider.

## Shop’tan alınan bir bina nasıl yapılır?

Örneğin yeni bir kütüphane yapmak için:

1. **Shop** bölümünü aç.
2. `Tiny Library — 95 coin` ürününü satın al.
3. **Inventory** bölümüne geç.
4. Kütüphanenin yanındaki **Place** butonuna bas.
5. Haritada boş bir alana bas.
6. Haritada tamamlanmamış bir blueprint oluşur.
7. Henüz atanmamış bir ajan görevini aç.
8. **Choose village project** butonuna bas.
9. Yeni kütüphane blueprint’ine bas.
10. İşçi kütüphaneye yürür ve çalışmaya başlar.
11. Kod sorularını doğru cevapladıkça kütüphane tamamlanır.

Shop’tan satın almak binayı anında tamamlamaz. Satın alma yalnızca blueprint verir. İnşaat için bir ajan görevi gerekir.

## Örnek ve gerçek ajan görevleri

Oyun, James’e atanmış password recovery, Ben’e atanmış product search ve henüz kişisi seçilmemiş deployment history olmak üzere üç örnek görevle başlar.

Üç görevi de tamamladıktan sonra yeni bir blueprint yerleştirirsen onu yapacak boş bir ajan görevi bulunmayabilir. Böyle bir durumda blueprint haritada bekler.

Yerel watcher çalıştırıldığında her kararlı kod değişikliği köye yeni bir iş emri getirir. Böylece yeni blueprint’ler gerçek Claude, Codex veya terminal görevleriyle tamamlanabilir.

Mevcut prototipte Shop akışını denemenin en kolay yolu:

1. Atanmamış deployment history görevini başlatmadan önce Shop’tan bir ürün al.
2. Ürünü Inventory’den haritaya yerleştir.
3. Boşta olan bir işçiyi seç ve görevi yeni blueprint’e ata.

## Arrange modu

**Arrange** modu tamamlanmış binaları, dekorasyonları ve yol parçalarını taşımanı sağlar.

1. Üst menüdeki **Arrange** butonuna bas.
2. Taşımak istediğin binayı, dekorasyonu veya yol parçasını sürükle.
3. Yeni konumuna bırak.
4. Bir yolu yatay veya dikey çevirmek için yola çift tıkla.
5. İşin bitince **Done** butonuna bas.

Şunlar taşınamaz:

- Builders’ Guild
- Launch Tower
- Henüz tamamlanmamış blueprint’ler

Blueprint’in taşınabilmesi için önce bir ajan tarafından tamamlanması gerekir.

## Harita kontrolleri

- Boş araziyi sürükleyerek haritayı hareket ettirebilirsin.
- `+` butonuyla yakınlaşabilirsin.
- `−` butonuyla uzaklaşabilirsin.
- Grid butonuyla başlangıç görünümüne dönebilirsin.

## Gerçek Claude Code projesini bağlama

İlk terminalde oyunu çalıştır:

```bash
cd /Users/kuzeyerturk/Desktop/gamegenticAI
npm run dev
```

İkinci terminalde watcher’ı başlat. Proje yolunu Claude Code ile çalıştığın Git reposunun gerçek yoluyla değiştir:

```bash
cd /Users/kuzeyerturk/Desktop/gamegenticAI
npm run watch:agents -- --project /projenin/tam/yolu --source Claude --claude-questions
```

Claude Code ile o projede normal şekilde çalışmaya devam et. Watcher ilk Git değişikliğini gördüğü anda oyunda atanmamış bir görev açar; Claude hâlâ yazarken işçiyi ve binayı seçebilirsin. Diff birkaç saniye değişmeden kaldığında sorular üretilir. Seçilen işçi yol üzerinden Guild’e döner ve vardığında inceleme açılır.

`--claude-questions` seçeneği diff’i oturum açtığın Claude Code üzerinden işleyerek daha anlamlı sorular üretir. Bu seçenek kullanılmazsa diff Mac’ten ayrılmaz ve basit sorular tamamen yerel olarak hazırlanır.

## Coin, XP, Streak ve Village Level

### Coin

Coin, Shop’tan bina ve dekorasyon satın almak için kullanılır.

Mevcut prototipte yaklaşık ödüller:

- Ara inşaat aşaması: 12 coin
- Tamamlanan proje: 30 coin
- Final sürüm kontrolü: 80 coin

### XP

XP, Village Level değerini yükseltir. Village Level yükseldikçe daha fazla Shop ürünü açılabilir.

### Streak

Streak, arka arkaya kaç soruyu doğru cevapladığını gösterir. Yanlış cevap verirsen sıfırlanır.

## Görevleri temizleme

- **Clear finished:** Tamamlanmış bütün görev kartlarını kaldırır; kazanılan XP, coin ve bina seviyeleri kalır.
- **Clear demo:** Üç başlangıç simulator görevini kaldırır; gerçek yerel görevleri ve köy düzenini korur.
- **Remove task:** Açık olan tamamlanmış veya henüz başlatılmamış tek bir görevi kaldırır.
- **Reset demo:** Bütün köyü başlangıç durumuna döndürür ve örnek görevleri yeniden oluşturur.

Silme onayları tarayıcı penceresinde değil, oyunun kendi kontrol panelinde görünür. Temizlenen görev kimlikleri kayıt altında tutulduğu için arka plandaki polling aynı görevi tekrar listeye eklemez.

## Launch Tower

Launch Tower’ın açılması için üç temel görevin tamamlanması gerekir:

- James’in password recovery görevi
- Ben’in product search görevi
- Bir işçi seçerek tamamlayacağın deployment history görevi

Üçü de tamamlandığında Launch Tower açılır. Kuleye bastığında bütün sürümle ilgili genel bir soru sorulur.

Bu soru tek bir dosyayı değil, yapılan tüm işlerin birlikte ne oluşturduğunu ölçer. Doğru cevap verirsen sürüm onaylanır ve ek coin ile XP kazanırsın.

## Kayıt sistemi

Mevcut hosted prototip köy durumunu Cloudflare D1 veritabanında saklar. Kaydedilen bilgiler arasında şunlar bulunur:

- Binaların konumları ve seviyeleri
- Dekorasyonlar
- Inventory
- Coin, XP ve streak
- İş emirlerinin mevcut aşamaları
- Tamamlanan sorular ve sürüm durumu

Gelecekteki gerçek ürünün yerel çalışması ve SQLite kullanması planlanmaktadır. Bu yerel-first mimari `docs/LOCAL_FIRST_DIRECTION.md` dosyasında açıklanmıştır.

## Oyunu hızlıca deneme sırası

1. James’e bas ve hazır olan soruyu cevapla.
2. James yeniden çalışırken Ben’in görevini aç.
3. Beklemek istemiyorsan **Finish simulated agent run** butonuna bas.
4. Ben’in ilk sorusunu cevapla.
5. Shop’tan bir bina satın al.
6. Inventory’den binayı haritaya yerleştir.
7. Atanmamış deployment history kartına bas.
8. Boş bir işçi seç ve **Choose village project** seçeneğine bas.
9. İşçiyi yeni blueprint’e gönder.
10. Bütün görev aşamalarını tamamla.
11. Launch Tower’a bas ve final sorusunu cevapla.

Kısaca:

> Shop’tan blueprint al, haritaya yerleştir, bir kod ajanını projeye ata ve kod değişikliğini anladığını göstererek inşaatı tamamla.

---

# English

## Core idea

Vibe Control District turns code changes made by AI agents into a village-building game.

The basic loop is:

```text
An AI agent works on code
            ↓
Its in-game worker travels to a village project
            ↓
A question appears when the agent stops
            ↓
The player correctly explains the change
            ↓
Construction advances or the building levels up
```

A code change becomes a **work order**. The player decides which village building that work should improve. The AI agent supplies the labor; the player’s understanding completes the construction.

## Who are James, Ben, Ollie, Luc, and Miguel?

They are the five selectable district workers. Codex, Claude, or Terminal describes where a work order came from; the player chooses which person will carry it. Any free worker can take any suitable village project.

## What does an unassigned work order mean?

An unassigned work order does not have a chosen person or village project yet.

To assign a worker:

1. Select the work order in the side panel.
2. Choose a free person from James, Ben, Ollie, Luc, and Miguel.
3. Press **Choose village project**.
4. Available buildings and construction sites are highlighted.
5. Select the building or blueprint you want to improve.
6. The chosen worker leaves the Builders’ Guild, follows the current road network, and begins construction.
7. An understanding question appears when the work stops.

Only one active worker can occupy a building at a time.

## Starting work orders

### James — Password recovery

James starts on password recovery. This task has two stages:

1. Reset request behavior
2. Reset-token safety

James’s first question is ready when the game begins. Answering it correctly sends him back to work. A second question appears after a short delay. Answering the second question completes the project and levels up the selected building.

### Ben — Product search

Ben is working on a larger ten-file search change. It is not reduced to one question.

It has four stages:

1. Filter behavior
2. Request timing
3. Protection against stale results
4. Release inspection

Each correct answer completes one construction stage. Ben then resumes work before the next question appears.

### Unassigned sample — Deployment history

This task starts without a person or building. Choose any free worker first, then assign the task to an existing building or a new blueprint purchased from the Shop.

## How questions work

The question screen also shows the relevant file snippets needed to investigate the answer. Added lines use `+` and removed lines use `−`, so the player can inspect the change instead of guessing. Sample tasks use representative diffs; tasks created by the local watcher use the real `git diff`.

Every question has three choices:

- A
- B
- C

A correct answer:

- Completes the current construction stage
- Awards XP
- Awards coins
- Increases the streak
- Completes or levels up the building after the final stage

An incorrect answer:

- Pauses construction
- Resets the streak
- Provides a small hint
- Allows the player to try again

Incorrect answers do not remove buildings, XP, or coins.

## Knowledge levels

The top-right menu contains three knowledge levels.

### Beginner

Focuses on what changes for the user.

Example:

> What does this change allow the user to do?

### Builder

Focuses on why an implementation choice was made.

Example:

> Why does search wait for 300 milliseconds?

### Expert

Focuses on security, data integrity, timing problems, and technical trade-offs.

Example:

> Why is the reset token stored as a hash?

The knowledge level can be changed at any time.

## How large changes are handled

A large task is not judged only by its number of files. Changes are grouped by logical responsibility.

A ten-file feature might be divided into:

```text
Core behavior → Request timing → Safety → Integration review
```

A small change may require one question. A large or risky feature may require three or four construction stages.

## How the Shop works

The numbers shown in the Shop are **coin prices**.

| Item | Price |
|---|---:|
| Apple Tree | 15 coins |
| Park Bench | 18 coins |
| Village Lamp | 22 coins |
| Stone Fountain | 45 coins |
| Garden Cottage | 55 coins |
| Village Bakery | 80 coins |
| Tiny Library | 95 coins |

Purchasing an item does not place it directly on the map. It first moves into the **Inventory**.

## How to construct a Shop building

For example, to construct a new library:

1. Open the **Shop**.
2. Purchase `Tiny Library — 95 coins`.
3. Open the **Inventory**.
4. Press **Place** next to the library.
5. Select an open area on the map.
6. An unfinished blueprint appears.
7. Open an unassigned agent work order.
8. Press **Choose village project**.
9. Select the new library blueprint.
10. The worker travels to the library and begins construction.
11. Correctly answer the code questions to complete it.

Buying an item only provides a blueprint. An agent work order is required to complete construction.

## Sample and live agent tasks

The game starts with three sample tasks: password recovery assigned to James, product search assigned to Ben, and deployment history waiting for you to choose a worker.

If all three tasks are completed before a new blueprint is placed, there may be no unassigned worker available to build it. The blueprint will remain on the map and wait.

When the local watcher sees the first Git change, it immediately creates a pending work order. The player can choose a worker and building while the real coding session continues. Once the diff settles, the generated questions update that same work order.

The easiest way to test the Shop today is:

1. Buy an item before starting the unassigned deployment-history task.
2. Place it from the Inventory.
3. Choose a free worker and assign the task to the new blueprint.

## Arrange mode

**Arrange** mode allows completed buildings, decorations, and road segments to be moved.

1. Press **Arrange** in the top toolbar.
2. Drag a completed building, decoration, or road segment.
3. Drop it in the new location.
4. Double-click a road to rotate it between horizontal and vertical.
5. Press **Done** when finished.

The following cannot be moved:

- Builders’ Guild
- Launch Tower
- Unfinished blueprints

A blueprint must be completed by an agent before it can be moved.

## Map controls

- Drag empty land to pan across the map.
- Use `+` to zoom in.
- Use `−` to zoom out.
- Use the grid button to return to the starting view.

## Connecting a real Claude Code project

Run the game in the first terminal:

```bash
cd /Users/kuzeyerturk/Desktop/gamegenticAI
npm run dev
```

Start the watcher in a second terminal, replacing the project path with the Git repository used by Claude Code:

```bash
cd /Users/kuzeyerturk/Desktop/gamegenticAI
npm run watch:agents -- --project /absolute/path/to/project --source Claude --claude-questions
```

Continue working normally with Claude Code in that repository. The first Git change immediately opens an unassigned task, so you can choose the worker and building while Claude is still writing. Once the diff remains stable, the watcher generates the questions. The worker follows the roads back to the Guild and the review opens on arrival.

The `--claude-questions` option processes the selected diff through your authenticated Claude Code session. Without this option, no code is sent to an AI service and simple fallback questions are generated entirely on the Mac.

## Coins, XP, streak, and Village Level

### Coins

Coins are spent on buildings and decorations in the Shop.

Approximate rewards in the current prototype:

- Intermediate construction stage: 12 coins
- Completed project: 30 coins
- Final release inspection: 80 coins

### XP

XP increases the Village Level. Higher levels can unlock additional Shop items.

### Streak

The streak records consecutive correct answers. It resets after an incorrect answer.

## Clearing task history

- **Clear finished:** Removes every completed task card while keeping earned XP, coins, and building levels.
- **Clear demo:** Removes the three built-in simulator tasks while keeping live local tasks and the village layout.
- **Remove task:** Removes the currently open completed or unassigned task.
- **Reset demo:** Restores the whole starter village and recreates the sample tasks.

Removal confirmations appear inside the game rather than in a browser dialog. Dismissed task ids are persisted, so background polling cannot add the same cleared task back to the list.

## Launch Tower

The three core work orders must be completed before the Launch Tower opens:

- James’s password-recovery task
- Ben’s product-search task
- The deployment-history task completed by the worker you choose

Once all three are complete, select the Launch Tower to answer one final question about the release as a whole.

This question checks the combined outcome rather than one individual file. A correct answer approves the release and awards additional coins and XP.

## Saving progress

The current hosted prototype stores the village state in Cloudflare D1. Saved information includes:

- Building positions and levels
- Decorations
- Inventory
- Coins, XP, and streak
- Work-order stages
- Completed questions and release state

The finished product is planned to run locally and use SQLite. The local-first architecture is documented in `docs/LOCAL_FIRST_DIRECTION.md`.

## Quick play sequence

1. Select James and answer the ready question.
2. Open Ben’s task while James resumes work.
3. Use **Finish simulated agent run** if you do not want to wait.
4. Answer Ben’s first question.
5. Purchase a building from the Shop.
6. Place it from the Inventory.
7. Select the unassigned deployment-history work order.
8. Choose a free worker and press **Choose village project**.
9. Send the worker to the new blueprint.
10. Complete every work-order stage.
11. Select the Launch Tower and answer the final release question.

In short:

> Buy a blueprint, place it on the map, assign a coding agent to it, and complete construction by demonstrating that you understand the code change.
