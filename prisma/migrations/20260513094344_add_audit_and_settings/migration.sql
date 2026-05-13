-- CreateTable
CREATE TABLE "Audit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "pageType" TEXT NOT NULL DEFAULT 'homepage',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "performanceScore" INTEGER,
    "seoScore" INTEGER,
    "accessibilityScore" INTEGER,
    "bestPracticesScore" INTEGER,
    "overallScore" INTEGER,
    "pagespeedData" TEXT,
    "fetchData" TEXT,
    "rulesData" TEXT,
    "screenshotDataUri" TEXT,
    "themeName" TEXT,
    "themeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "pagespeedApiKey" TEXT
);

-- CreateIndex
CREATE INDEX "Audit_shop_idx" ON "Audit"("shop");

-- CreateIndex
CREATE INDEX "Audit_shop_createdAt_idx" ON "Audit"("shop", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Settings_shop_key" ON "Settings"("shop");
