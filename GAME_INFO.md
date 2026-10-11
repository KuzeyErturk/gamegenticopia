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

## Milo, Ivy ve Pip kim?

Milo, Ivy ve Pip oyundaki işçi karakterleridir:

- **Milo:** Codex kaynaklı görevi temsil eder.
- **Ivy:** Claude kaynaklı görevi temsil eder.
- **Pip:** Terminal kaynaklı görevi temsil eder.

Bu karakterler şu anda gerçek Codex, Claude veya terminal oturumlarına bağlı değildir. Mevcut prototipte oyun akışını göstermek için hazırlanmış örnek ajanlardır.

Gelecekte gerçek yerel bağlantı eklendiğinde her aktif Codex, Claude veya terminal görevi köye yeni bir işçi ve iş emri gönderecektir.

Ajanların belirli bir binası yoktur. Her ajan, oyuncunun seçtiği uygun bir binada çalışabilir.

## “Assign me” ne demek?

`Assign me`, işçinin henüz bir köy projesine atanmadığı anlamına gelir.

Bir işçiyi atamak için:

1. Sağ panelde işçinin iş emrine bas.
2. **Choose village project** butonuna bas.
3. Haritadaki uygun binalar ve inşaat alanları vurgulanır.
4. Geliştirmek istediğin binaya veya tamamlamak istediğin blueprint’e bas.
5. İşçi Builders’ Guild’den çıkar ve seçilen alana yürür.
6. İşçi çalışmaya başlar.
7. Çalışma durduğunda bir anlama sorusu açılır.

Aynı anda bir binada yalnızca bir aktif işçi çalışabilir.

## Başlangıç görevleri

### Milo — Password recovery

Milo, şifre sıfırlama özelliği üzerinde çalışır. Bu görev iki aşamalıdır:

1. Şifre sıfırlama isteği
2. Reset token güvenliği

Milo’nun ilk sorusu oyun başladığında hazırdır. İlk soruyu doğru cevapladığında Milo yeniden çalışır. Birkaç saniye sonra ikinci soru açılır. İkinci soru da doğru cevaplanırsa seçilen bina seviye atlar.

### Ivy — Product search

Ivy, on dosyalık daha büyük bir arama özelliği üzerinde çalışır. Bu nedenle görev tek sorudan oluşmaz.

Görevin dört aşaması vardır:

1. Filtre davranışı
2. Arama isteklerinin zamanlaması
3. Eski arama sonuçlarının yeni sonuçları ezmesini engelleme
4. Genel sürüm kontrolü

Her doğru cevap bir inşaat aşamasını tamamlar. Ivy daha sonra çalışmaya devam eder ve bir sonraki aşamanın sorusu açılır.

### Pip — Deployment history

Pip’in görevi başlangıçta bir binaya atanmamıştır. Bu nedenle üzerinde `Assign me` yazar.

Pip’i mevcut bir binaya veya Shop’tan aldığın yeni bir blueprint’e atayabilirsin.

## Sorular nasıl çalışır?

Soru ekranı, cevap vermek için bakman gereken ilgili dosya parçalarını da gösterir. Eklenen satırlar `+`, silinen satırlar `−` ile işaretlenir. Böylece cevabı tahmin etmek yerine değişikliği inceleyebilirsin. Mevcut demo örnek diff’ler kullanır; yerel terminal bağlantısı tamamlandığında bu alan gerçek `git diff` verisini gösterecektir.

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

## Mevcut prototip sınırlaması

Şu anda yalnızca üç örnek ajan görevi vardır: Milo, Ivy ve Pip.

Üç görevi de tamamladıktan sonra yeni bir blueprint yerleştirirsen onu yapacak boş bir ajan görevi bulunmayabilir. Böyle bir durumda blueprint haritada bekler.

Gerçek yerel Codex, Claude ve terminal bağlantısı eklendiğinde her yeni kod görevi köye yeni bir iş emri getirecektir. Böylece yeni blueprint’ler sonraki gerçek görevlerle tamamlanabilecektir.

Mevcut prototipte Shop akışını denemenin en kolay yolu:

1. Pip’i bir projeye atamadan önce Shop’tan bir ürün al.
2. Ürünü Inventory’den haritaya yerleştir.
3. Pip’i yeni blueprint’e ata.

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

## Launch Tower

Launch Tower’ın açılması için üç temel görevin tamamlanması gerekir:

- Milo’nun password recovery görevi
- Ivy’nin product search görevi
- Pip’in deployment history görevi

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

1. Milo’ya bas ve hazır olan soruyu cevapla.
2. Milo yeniden çalışırken Ivy’nin görevini aç.
3. Beklemek istemiyorsan **Finish simulated agent run** butonuna bas.
4. Ivy’nin ilk sorusunu cevapla.
5. Shop’tan bir bina satın al.
6. Inventory’den binayı haritaya yerleştir.
7. Pip’in kartına bas.
8. **Choose village project** seçeneğine bas.
9. Pip’i yeni blueprint’e ata.
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

## Who are Milo, Ivy, and Pip?

Milo, Ivy, and Pip are worker characters:

- **Milo:** Represents a Codex task.
- **Ivy:** Represents a Claude task.
- **Pip:** Represents a terminal task.

They are not connected to real Codex, Claude, or terminal sessions yet. They are sample agents used to demonstrate the current game loop.

When the local connector is implemented, each active Codex, Claude, or terminal task will create a worker and work order in the village.

Agents do not own specific buildings. Any agent can work on any suitable project selected by the player.

## What does “Assign me” mean?

`Assign me` means the worker has not been assigned to a village project yet.

To assign a worker:

1. Select the worker’s work order in the side panel.
2. Press **Choose village project**.
3. Available buildings and construction sites are highlighted.
4. Select the building or blueprint you want to improve.
5. The worker leaves the Builders’ Guild and walks to the selected location.
6. The worker begins construction.
7. An understanding question appears when the work stops.

Only one active worker can occupy a building at a time.

## Starting work orders

### Milo — Password recovery

Milo is working on password recovery. This task has two stages:

1. Reset request behavior
2. Reset-token safety

Milo’s first question is ready when the game begins. Answering it correctly sends Milo back to work. A second question appears after a short delay. Answering the second question completes the project and levels up the selected building.

### Ivy — Product search

Ivy is working on a larger ten-file search change. It is not reduced to one question.

It has four stages:

1. Filter behavior
2. Request timing
3. Protection against stale results
4. Release inspection

Each correct answer completes one construction stage. Ivy then resumes work before the next question appears.

### Pip — Deployment history

Pip begins without an assigned building, so the character displays `Assign me`.

Pip can be assigned to an existing building or a new blueprint purchased from the Shop.

## How questions work

The question screen also shows the relevant file snippets needed to investigate the answer. Added lines use `+` and removed lines use `−`, so the player can inspect the change instead of guessing. The current demo uses representative diffs; the local terminal connector will replace them with real `git diff` data.

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

## Current prototype limitation

The prototype currently includes only three sample agent tasks: Milo, Ivy, and Pip.

If all three tasks are completed before a new blueprint is placed, there may be no unassigned worker available to build it. The blueprint will remain on the map and wait.

The future local Codex, Claude, and terminal connector will solve this by creating a new work order whenever a real coding task begins.

The easiest way to test the Shop today is:

1. Buy an item before assigning Pip.
2. Place it from the Inventory.
3. Assign Pip to the new blueprint.

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

## Launch Tower

The three core work orders must be completed before the Launch Tower opens:

- Milo’s password-recovery task
- Ivy’s product-search task
- Pip’s deployment-history task

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

1. Select Milo and answer the ready question.
2. Open Ivy’s task while Milo resumes work.
3. Use **Finish simulated agent run** if you do not want to wait.
4. Answer Ivy’s first question.
5. Purchase a building from the Shop.
6. Place it from the Inventory.
7. Select Pip’s work order.
8. Press **Choose village project**.
9. Assign Pip to the new blueprint.
10. Complete every work-order stage.
11. Select the Launch Tower and answer the final release question.

In short:

> Buy a blueprint, place it on the map, assign a coding agent to it, and complete construction by demonstrating that you understand the code change.
