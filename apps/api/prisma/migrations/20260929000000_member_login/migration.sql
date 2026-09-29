-- CreateTable
CREATE TABLE "MemberLogin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sealedHome" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberLogin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemberLogin_userId_key" ON "MemberLogin"("userId");

-- AddForeignKey
ALTER TABLE "MemberLogin" ADD CONSTRAINT "MemberLogin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
