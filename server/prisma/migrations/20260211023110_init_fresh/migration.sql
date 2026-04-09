CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pages" JSONB NOT NULL DEFAULT '[]',
    "preview" TEXT,
    "background" TEXT,
    "isMaster" BOOLEAN NOT NULL DEFAULT false,
    "ownerId" TEXT,
    "originTemplateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReportInstance" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "templateId" TEXT,
    "variableSnapshot" JSONB,
    "pages" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportInstance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Variable" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'USER',
    "ownerId" TEXT,

    CONSTRAINT "Variable_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

ALTER TABLE "Template" ADD CONSTRAINT "Template_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Template" ADD CONSTRAINT "Template_originTemplateId_fkey" FOREIGN KEY ("originTemplateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReportInstance" ADD CONSTRAINT "ReportInstance_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Variable" ADD CONSTRAINT "Variable_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
