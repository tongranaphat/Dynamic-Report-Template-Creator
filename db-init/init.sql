--
-- PostgreSQL database dump
--

\restrict ZZtGcHWe8IeEfWGmHsnziy2o91yjOh32SwA4HyZgOFcrXDURPJ23cLfNVN7H9Zd

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

-- Started on 2026-04-16 12:03:56

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 5 (class 2615 OID 88270)
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- TOC entry 5070 (class 0 OID 0)
-- Dependencies: 5
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 223 (class 1259 OID 88325)
-- Name: Asset; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Asset" (
    id text NOT NULL,
    filename text NOT NULL,
    mimetype text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    filepath text NOT NULL,
    url text NOT NULL
);


--
-- TOC entry 224 (class 1259 OID 88338)
-- Name: PdfCache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PdfCache" (
    "OriginalFileId" text NOT NULL,
    "OriginalFile" boolean DEFAULT true NOT NULL,
    "FileName" text NOT NULL,
    "OriginalUrlorPath" text NOT NULL,
    "FilePath" text NOT NULL,
    "EditedFile" boolean DEFAULT false NOT NULL,
    "editState" jsonb,
    "EditedFilePath" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "lastEditAt" timestamp(3) without time zone NOT NULL,
    "TempFilePath" text
);


--
-- TOC entry 221 (class 1259 OID 88297)
-- Name: ReportInstance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ReportInstance" (
    id text NOT NULL,
    name text NOT NULL,
    "templateId" text,
    "variableSnapshot" jsonb,
    pages jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    "pdfUrl" text,
    data jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 225 (class 1259 OID 88745)
-- Name: Signatory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Signatory" (
    id text NOT NULL,
    "fullName" text NOT NULL,
    "signatureImage" text,
    "variableName" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "position" text,
    "prefixText" text
);


--
-- TOC entry 220 (class 1259 OID 88281)
-- Name: Template; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Template" (
    id text NOT NULL,
    name text NOT NULL,
    pages jsonb DEFAULT '[]'::jsonb NOT NULL,
    preview text,
    background text,
    "isMaster" boolean DEFAULT false NOT NULL,
    "ownerId" text,
    "originTemplateId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 219 (class 1259 OID 88271)
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    username text NOT NULL,
    password text NOT NULL
);


--
-- TOC entry 222 (class 1259 OID 88313)
-- Name: Variable; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Variable" (
    id text NOT NULL,
    key text NOT NULL,
    label text NOT NULL,
    scope text DEFAULT 'USER'::text NOT NULL,
    "ownerId" text
);


--
-- TOC entry 5062 (class 0 OID 88325)
-- Dependencies: 223
-- Data for Name: Asset; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Asset" (id, filename, mimetype, "createdAt", filepath, url) FROM stdin;
c8a2f033-e53a-4da6-b2f9-a60172a13e3e	1774863860446-reference_crops_forcep1.png	image/png	2026-03-30 09:44:20.453	/uploads/assets/1774863860446-reference_crops_forcep1.png	http://localhost:4010/uploads/assets/1774863860446-reference_crops_forcep1.png
88e71e83-31df-44c5-9f52-9a1f0568b787	1774928291327-reference_crops_plier.png	image/png	2026-03-31 03:38:11.331	/uploads/assets/1774928291327-reference_crops_plier.png	http://localhost:4010/uploads/assets/1774928291327-reference_crops_plier.png
e9366bb1-9905-4a2b-a730-ca3c569fc7e9	1775640614831-signature.png	image/png	2026-04-08 09:30:14.835	/uploads/assets/1775640614831-signature.png	http://localhost:4010/uploads/assets/1775640614831-signature.png
fa913a32-47f1-4930-bc9f-b9935e0cc7bf	1775642102995-âPngtreeâstar vector icon_4015244.png	image/png	2026-04-08 09:55:02.998	/uploads/assets/1775642102995-âPngtreeâstar vector icon_4015244.png	http://localhost:4010/uploads/assets/1775642102995-âPngtreeâstar vector icon_4015244.png
\.


--
-- TOC entry 5063 (class 0 OID 88338)
-- Dependencies: 224
-- Data for Name: PdfCache; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PdfCache" ("OriginalFileId", "OriginalFile", "FileName", "OriginalUrlorPath", "FilePath", "EditedFile", "editState", "EditedFilePath", "createdAt", "lastEditAt", "TempFilePath") FROM stdin;
4641f1e1-f1fa-4ace-85ff-b224b0e37f1c	t	à¸à¸²à¸à¸ªà¸²à¸£à¸à¸£à¸£à¸.pdf	à¸à¸²à¸à¸ªà¸²à¸£à¸à¸£à¸£à¸.pdf	/uploads/original/cache/1776310148556-à¸à¸²à¸à¸ªà¸²à¸£à¸à¸£à¸£à¸.pdf	f	\N	\N	2026-04-16 03:29:08.646	2026-04-16 03:56:47.557	\N
\.


--
-- TOC entry 5060 (class 0 OID 88297)
-- Dependencies: 221
-- Data for Name: ReportInstance; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ReportInstance" (id, name, "templateId", "variableSnapshot", pages, status, "pdfUrl", data, "createdAt", "updatedAt") FROM stdin;
\.


--
-- TOC entry 5064 (class 0 OID 88745)
-- Dependencies: 225
-- Data for Name: Signatory; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Signatory" (id, "fullName", "signatureImage", "variableName", "createdAt", "position", "prefixText") FROM stdin;
8c86513f-50f3-42aa-b4a8-4df5610dd020	นายเทสเตอร์ ทดลองระบบ	/uploads/signatures/signature (2).png	{{test_sig}}	2026-04-01 03:14:37.428	นักทดลองระบบ	ขอมอบหมายให้ไปทดลองระบบ
\.


--
-- TOC entry 5059 (class 0 OID 88281)
-- Dependencies: 220
-- Data for Name: Template; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Template" (id, name, pages, preview, background, "isMaster", "ownerId", "originTemplateId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- TOC entry 5058 (class 0 OID 88271)
-- Dependencies: 219
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."User" (id, username, password) FROM stdin;

\.


--
-- TOC entry 5061 (class 0 OID 88313)
-- Dependencies: 222
-- Data for Name: Variable; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Variable" (id, key, label, scope, "ownerId") FROM stdin;
\.


--
-- TOC entry 4901 (class 2606 OID 88337)
-- Name: Asset Asset_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Asset"
    ADD CONSTRAINT "Asset_pkey" PRIMARY KEY (id);


--
-- TOC entry 4903 (class 2606 OID 88355)
-- Name: PdfCache PdfCache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PdfCache"
    ADD CONSTRAINT "PdfCache_pkey" PRIMARY KEY ("OriginalFileId");


--
-- TOC entry 4897 (class 2606 OID 88312)
-- Name: ReportInstance ReportInstance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReportInstance"
    ADD CONSTRAINT "ReportInstance_pkey" PRIMARY KEY (id);


--
-- TOC entry 4905 (class 2606 OID 88756)
-- Name: Signatory Signatory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Signatory"
    ADD CONSTRAINT "Signatory_pkey" PRIMARY KEY (id);


--
-- TOC entry 4895 (class 2606 OID 88296)
-- Name: Template Template_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Template"
    ADD CONSTRAINT "Template_pkey" PRIMARY KEY (id);


--
-- TOC entry 4892 (class 2606 OID 88280)
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- TOC entry 4899 (class 2606 OID 88324)
-- Name: Variable Variable_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Variable"
    ADD CONSTRAINT "Variable_pkey" PRIMARY KEY (id);


--
-- TOC entry 4906 (class 1259 OID 88757)
-- Name: Signatory_variableName_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Signatory_variableName_key" ON public."Signatory" USING btree ("variableName");


--
-- TOC entry 4893 (class 1259 OID 88356)
-- Name: User_username_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_username_key" ON public."User" USING btree (username);


--
-- TOC entry 4909 (class 2606 OID 88367)
-- Name: ReportInstance ReportInstance_templateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReportInstance"
    ADD CONSTRAINT "ReportInstance_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES public."Template"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 4907 (class 2606 OID 88362)
-- Name: Template Template_originTemplateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Template"
    ADD CONSTRAINT "Template_originTemplateId_fkey" FOREIGN KEY ("originTemplateId") REFERENCES public."Template"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 4908 (class 2606 OID 88357)
-- Name: Template Template_ownerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Template"
    ADD CONSTRAINT "Template_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 4910 (class 2606 OID 88372)
-- Name: Variable Variable_ownerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Variable"
    ADD CONSTRAINT "Variable_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


-- Completed on 2026-04-16 12:03:57

--
-- PostgreSQL database dump complete
--

\unrestrict ZZtGcHWe8IeEfWGmHsnziy2o91yjOh32SwA4HyZgOFcrXDURPJ23cLfNVN7H9Zd

