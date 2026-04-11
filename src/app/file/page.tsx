"use client";

import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import callApi, { getErrorMessageAsync } from "@/src/lib/axios";
import styles from "../../styles/fileCompare.module.css";

type SheetHeaderItem = {
	sheetName: string;
	header: string[];
};

type UploadSlotState = {
	id: number;
	file: File | null;
	fileName: string;
	sheets: SheetHeaderItem[];
	selectedSheet: string;
	loading: boolean;
	error: string;
};

type CompareColumnPair = {
	id: number;
	leftColumn: string;
	rightColumn: string;
	like: boolean;
};

type CompareApiResult = {
	onlyInFile1: Record<string, unknown>[];
	onlyInFile2: Record<string, unknown>[];
};

type ExportRecordResponse = {
	record?: string;
};

function createUploadSlot(id: number): UploadSlotState {
	return {
		id,
		file: null,
		fileName: "",
		sheets: [],
		selectedSheet: "",
		loading: false,
		error: "",
	};
}

function createCompareColumnPair(id: number): CompareColumnPair {
	return {
		id,
		leftColumn: "",
		rightColumn: "",
		like: false,
	};
}

function normalizeSheetResponse(data: unknown): SheetHeaderItem[] {
	if (!Array.isArray(data)) {
		return [];
	}

	return data
		.filter((item): item is { sheetName?: unknown; header?: unknown } => typeof item === "object" && item !== null)
		.map((item) => {
			const sheetName = typeof item.sheetName === "string" ? item.sheetName : "";
			const header = Array.isArray(item.header)
				? item.header.filter((h): h is string => typeof h === "string")
				: [];

			return {
				sheetName,
				header,
			};
		})
		.filter((item) => item.sheetName.trim().length > 0);
}

function normalizeCompareResponse(data: unknown): CompareApiResult | null {
	if (typeof data !== "object" || data === null) {
		return null;
	}

	const payload = data as { onlyInFile1?: unknown; onlyInFile2?: unknown };

	const toObjectArray = (arr: unknown): Record<string, unknown>[] => {
		if (!Array.isArray(arr)) return [];
		return arr.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null);
	};

	return {
		onlyInFile1: toObjectArray(payload.onlyInFile1),
		onlyInFile2: toObjectArray(payload.onlyInFile2),
	};
}

function getRecordFromCompareResponse(data: unknown): unknown {
	if (typeof data !== "object" || data === null) {
		return null;
	}

	const payload = data as ExportRecordResponse;
	return payload.record ?? null;
}

function formatCountdown(ms: number): string {
	if (ms <= 0) {
		return "00:00";
	}

	const totalSeconds = Math.ceil(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;

	return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getFileNameFromDisposition(disposition?: string): string {
	if (!disposition) {
		return `compare-result-${Date.now()}.xlsx`;
	}

	const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
	if (utf8Match?.[1]) {
		return decodeURIComponent(utf8Match[1]);
	}

	const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
	if (plainMatch?.[1]) {
		return plainMatch[1];
	}

	return `compare-result-${Date.now()}.xlsx`;
}

function useDragScroll() {
	const ref = useRef<HTMLDivElement>(null);
	const isDragging = useRef(false);
	const startX = useRef(0);
	const scrollLeft = useRef(0);

	const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
		const el = ref.current;
		if (!el) return;
		isDragging.current = true;
		startX.current = e.pageX - el.offsetLeft;
		scrollLeft.current = el.scrollLeft;
		el.style.cursor = "grabbing";
		el.style.userSelect = "none";
	}, []);

	const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
		if (!isDragging.current || !ref.current) return;
		e.preventDefault();
		const x = e.pageX - ref.current.offsetLeft;
		const walk = x - startX.current;
		ref.current.scrollLeft = scrollLeft.current - walk;
	}, []);

	const onMouseUp = useCallback(() => {
		if (!ref.current) return;
		isDragging.current = false;
		ref.current.style.cursor = "grab";
		ref.current.style.userSelect = "";
	}, []);

	return { ref, onMouseDown, onMouseMove, onMouseUp, onMouseLeave: onMouseUp };
}

export default function FileComparePage() {
	const router = useRouter();
	const [uploadSlots, setUploadSlots] = useState<UploadSlotState[]>([createUploadSlot(1)]);
	const [leftFileId, setLeftFileId] = useState<number | null>(1);
	const [rightFileId, setRightFileId] = useState<number | null>(1);
	const [leftSheetName, setLeftSheetName] = useState("");
	const [rightSheetName, setRightSheetName] = useState("");
	const [compareColumnPairs, setCompareColumnPairs] = useState<CompareColumnPair[]>([createCompareColumnPair(1)]);
	const [isComparing, setIsComparing] = useState(false);
	const [isExporting, setIsExporting] = useState(false);
	const [compareError, setCompareError] = useState("");
	const [compareResult, setCompareResult] = useState<unknown>(null);
	const [exportError, setExportError] = useState("");
	const [exportAvailableUntil, setExportAvailableUntil] = useState<number | null>(null);
	const [countdownNow, setCountdownNow] = useState<number>(() => Date.now());

	const uploadedSlots = useMemo(() => uploadSlots.filter((slot) => slot.file), [uploadSlots]);
	const canAddMoreSlot = uploadSlots.length < 2;

	useEffect(() => {
		const token = localStorage.getItem("access_token");
		if (!token) {
			router.push("/");
		}
	}, [router]);

	const getSlotById = (id: number | null) => {
		if (!id) {
			return undefined;
		}

		return uploadSlots.find((slot) => slot.id === id);
	};

	const uploadedIds = useMemo(() => uploadedSlots.map((slot) => slot.id), [uploadedSlots]);

	const effectiveLeftFileId = useMemo(() => {
		if (uploadedIds.length === 0) {
			return null;
		}

		if (uploadedIds.length === 1) {
			return uploadedIds[0];
		}

		if (leftFileId && uploadedIds.includes(leftFileId)) {
			return leftFileId;
		}

		return uploadedIds[0];
	}, [leftFileId, uploadedIds]);

	const effectiveRightFileId = useMemo(() => {
		if (uploadedIds.length === 0) {
			return null;
		}

		if (uploadedIds.length === 1) {
			return uploadedIds[0];
		}

		if (rightFileId && uploadedIds.includes(rightFileId)) {
			return rightFileId;
		}

		const differentFromLeft = uploadedIds.find((id) => id !== effectiveLeftFileId);
		return differentFromLeft ?? uploadedIds[0];
	}, [effectiveLeftFileId, rightFileId, uploadedIds]);

	const leftSlot = getSlotById(effectiveLeftFileId);
	const rightSlot = getSlotById(effectiveRightFileId);

	const leftSheets = useMemo(() => leftSlot?.sheets ?? [], [leftSlot]);
	const rightSheets = useMemo(() => rightSlot?.sheets ?? [], [rightSlot]);

	const effectiveLeftSheetName = useMemo(() => {
		if (leftSheets.some((sheet) => sheet.sheetName === leftSheetName)) {
			return leftSheetName;
		}

		return leftSheets[0]?.sheetName ?? "";
	}, [leftSheetName, leftSheets]);

	const effectiveRightSheetName = useMemo(() => {
		if (rightSheets.some((sheet) => sheet.sheetName === rightSheetName)) {
			return rightSheetName;
		}

		return rightSheets[0]?.sheetName ?? "";
	}, [rightSheetName, rightSheets]);

	const leftHeaders = useMemo(() => {
		const matchedSheet = leftSheets.find((sheet) => sheet.sheetName === effectiveLeftSheetName);
		return matchedSheet?.header ?? [];
	}, [effectiveLeftSheetName, leftSheets]);

	const rightHeaders = useMemo(() => {
		const matchedSheet = rightSheets.find((sheet) => sheet.sheetName === effectiveRightSheetName);
		return matchedSheet?.header ?? [];
	}, [effectiveRightSheetName, rightSheets]);

	const effectiveComparePairs = useMemo(
		() =>
			compareColumnPairs.map((pair) => ({
				...pair,
				leftColumn: leftHeaders.includes(pair.leftColumn) ? pair.leftColumn : "",
				rightColumn: rightHeaders.includes(pair.rightColumn) ? pair.rightColumn : "",
			})),
		[compareColumnPairs, leftHeaders, rightHeaders],
	);

	const completedPairs = useMemo(
		() => effectiveComparePairs.filter((pair) => pair.leftColumn && pair.rightColumn),
		[effectiveComparePairs],
	);

	const hasIncompletePair = useMemo(
		() => effectiveComparePairs.some((pair) => Boolean(pair.leftColumn) !== Boolean(pair.rightColumn)),
		[effectiveComparePairs],
	);

	const maxPairCount = useMemo(
		() => Math.min(leftHeaders.length, rightHeaders.length),
		[leftHeaders.length, rightHeaders.length],
	);

	const canAddColumnPair = useMemo(
		() => leftHeaders.length > 0 && rightHeaders.length > 0 && compareColumnPairs.length < maxPairCount,
		[compareColumnPairs.length, leftHeaders.length, maxPairCount, rightHeaders.length],
	);

	const updateSlot = (slotId: number, updater: (slot: UploadSlotState) => UploadSlotState) => {
		setUploadSlots((prev) => prev.map((slot) => (slot.id === slotId ? updater(slot) : slot)));
	};

	const fetchHeaderInFile = async (file: File): Promise<SheetHeaderItem[]> => {
		const formData = new FormData();
		formData.append("File", file);

		const response = await callApi.post("/file/getHeaderInFile", formData, {
			headers: {
				"Content-Type": "multipart/form-data",
			},
		});

		return normalizeSheetResponse(response.data);
	};

	const handleFileChange = async (slotId: number, event: ChangeEvent<HTMLInputElement>) => {
		const selectedFile = event.target.files?.[0] ?? null;
		event.target.value = "";

		if (!selectedFile) {
			return;
		}

		updateSlot(slotId, (slot) => ({
			...slot,
			file: selectedFile,
			fileName: selectedFile.name,
			sheets: [],
			selectedSheet: "",
			error: "",
			loading: true,
		}));

		try {
			const sheets = await fetchHeaderInFile(selectedFile);
			updateSlot(slotId, (slot) => ({
				...slot,
				sheets,
				selectedSheet: sheets[0]?.sheetName ?? "",
				loading: false,
				error: sheets.length === 0 ? "Không tìm thấy sheet/header trong file." : "",
			}));
		} catch (error) {
			const message = await getErrorMessageAsync(error, "Không thể đọc cấu trúc file.");

			updateSlot(slotId, (slot) => ({
				...slot,
				loading: false,
				error: message,
			}));
		}
	};

	const handleAddSecondSlot = () => {
		if (!canAddMoreSlot) {
			return;
		}

		setUploadSlots((prev) => [...prev, createUploadSlot(2)]);
	};

	const handleRemoveSecondSlot = () => {
		setUploadSlots((prev) => prev.filter((slot) => slot.id !== 2));
		setLeftFileId(1);
		setRightFileId(1);
		setRightSheetName("");
		setCompareColumnPairs([createCompareColumnPair(1)]);
	};

	const handleAddColumnPair = () => {
		if (!canAddColumnPair) {
			return;
		}

		setCompareColumnPairs((prev) => {
			const nextId = (prev[prev.length - 1]?.id ?? 0) + 1;
			return [...prev, createCompareColumnPair(nextId)];
		});
		setCompareResult(null);
		setCompareError("");
	};

	const handleRemoveColumnPair = (pairId: number) => {
		setCompareColumnPairs((prev) => {
			if (prev.length === 1) {
				return prev;
			}

			return prev.filter((pair) => pair.id !== pairId);
		});
		setCompareResult(null);
		setCompareError("");
	};

	const updateColumnPair = (pairId: number, side: "left" | "right", value: string) => {
		setCompareColumnPairs((prev) =>
			prev.map((pair) => {
				if (pair.id !== pairId) {
					return pair;
				}

				if (side === "left") {
					return { ...pair, leftColumn: value };
				}

				return { ...pair, rightColumn: value };
			}),
		);
		setCompareResult(null);
		setCompareError("");
	};

	const updateColumnPairLike = (pairId: number, checked: boolean) => {
		setCompareColumnPairs((prev) =>
			prev.map((pair) => (pair.id === pairId ? { ...pair, like: checked } : pair)),
		);
		setCompareResult(null);
		setCompareError("");
	};

	const getAvailableHeadersForPair = (pairId: number, side: "left" | "right") => {
		const allHeaders = side === "left" ? leftHeaders : rightHeaders;

		const selectedInOtherPairs = new Set(
			effectiveComparePairs
				.filter((pair) => pair.id !== pairId)
				.map((pair) => (side === "left" ? pair.leftColumn : pair.rightColumn))
				.filter((column) => column.length > 0),
		);

		return allHeaders.filter((header) => !selectedInOtherPairs.has(header));
	};

	const canCompare = Boolean(
		effectiveLeftFileId &&
			effectiveRightFileId &&
			effectiveLeftSheetName &&
			effectiveRightSheetName &&
			completedPairs.length > 0 &&
			!hasIncompletePair,
	);

	const dragLeft = useDragScroll();
	const dragRight = useDragScroll();

	const normalizedCompareResult = useMemo(() => normalizeCompareResponse(compareResult), [compareResult]);
	const compareRecord = useMemo(() => getRecordFromCompareResponse(compareResult), [compareResult]);
	const leftUnmatchedRows = normalizedCompareResult?.onlyInFile1 ?? [];
	const rightUnmatchedRows = normalizedCompareResult?.onlyInFile2 ?? [];
	const leftResultColumns = useMemo(
		() =>
			completedPairs.length > 0
				? completedPairs.map((p) => p.leftColumn)
				: leftUnmatchedRows.length > 0
					? Object.keys(leftUnmatchedRows[0])
					: [],
		[completedPairs, leftUnmatchedRows],
	);
	const rightResultColumns = useMemo(
		() =>
			completedPairs.length > 0
				? completedPairs.map((p) => p.rightColumn)
				: rightUnmatchedRows.length > 0
					? Object.keys(rightUnmatchedRows[0])
					: [],
		[completedPairs, rightUnmatchedRows],
	);
	const leftSourceDescription = [leftSlot?.fileName, effectiveLeftSheetName ? `Sheet: ${effectiveLeftSheetName}` : ""]
		.filter(Boolean)
		.join(" | ");
	const rightSourceDescription = [rightSlot?.fileName, effectiveRightSheetName ? `Sheet: ${effectiveRightSheetName}` : ""]
		.filter(Boolean)
		.join(" | ");
	const remainingExportMs = useMemo(() => {
		if (!exportAvailableUntil) {
			return 0;
		}

		return Math.max(exportAvailableUntil - countdownNow, 0);
	}, [countdownNow, exportAvailableUntil]);
	const isExportWindowActive = remainingExportMs > 0;
	const canExport = Boolean(compareRecord) && isExportWindowActive && !isComparing;
	const exportCountdownText = formatCountdown(remainingExportMs);

	useEffect(() => {
		if (!exportAvailableUntil) {
			return;
		}

		const timer = window.setInterval(() => {
			setCountdownNow(Date.now());
		}, 1000);

		return () => {
			window.clearInterval(timer);
		};
	}, [exportAvailableUntil]);

	useEffect(() => {
		if (exportAvailableUntil && Date.now() >= exportAvailableUntil) {
			setExportAvailableUntil(null);
		}
	}, [countdownNow, exportAvailableUntil]);

	useEffect(() => {
		if (compareResult === null) {
			setExportAvailableUntil(null);
		}
	}, [compareResult]);

	const handleCompareFiles = async () => {
		if (!canCompare || !leftSlot?.file || !rightSlot?.file) {
			setCompareError("Thiếu dữ liệu để so sánh.");
			return;
		}

		try {
			setIsComparing(true);
			setCompareError("");
			setExportError("");
			setCompareResult(null);
			setExportAvailableUntil(null);

			const formData = new FormData();
			const appendedFileIds = new Set<number>();

			if (effectiveLeftFileId && !appendedFileIds.has(effectiveLeftFileId)) {
				formData.append("File", leftSlot.file);
				appendedFileIds.add(effectiveLeftFileId);
			}

			if (effectiveRightFileId && !appendedFileIds.has(effectiveRightFileId)) {
				formData.append("File", rightSlot.file);
				appendedFileIds.add(effectiveRightFileId);
			}

			const condition = {
				sheetName: {
					file1: effectiveLeftSheetName,
					file2: effectiveRightSheetName,
				},
				mapping: completedPairs.map((pair) => ({
					file1: pair.leftColumn,
					file2: pair.rightColumn,
					...(pair.like ? { like: true } : {}),
				})),
			};

			formData.append("condition", JSON.stringify(condition));

			const response = await callApi.post<unknown>("/file/compareFile", formData, {
				headers: {
					"Content-Type": "multipart/form-data",
				},
			});

			setCompareResult(response.data);
			setCountdownNow(Date.now());
			setExportAvailableUntil(Date.now() + 5 * 60 * 1000);
		} catch (error) {
			const message = await getErrorMessageAsync(error, "So sánh file thất bại.");
			setCompareError(message);
			setExportAvailableUntil(null);
		} finally {
			setIsComparing(false);
		}
	};

	const handleExportCompareResult = async () => {
		if (!canExport) {
			return;
		}

		try {
			setIsExporting(true);
			setExportError("");

			const response = await callApi.post<Blob>(
				"/file/exportCompareResult",
				{
					record: compareRecord,
					sheetNames: [effectiveLeftSheetName, effectiveRightSheetName],
				},
				{
					responseType: "blob",
				},
			);

			const blobUrl = window.URL.createObjectURL(response.data);
			const downloadLink = document.createElement("a");
			downloadLink.href = blobUrl;
			downloadLink.download = getFileNameFromDisposition(response.headers["content-disposition"]);
			document.body.appendChild(downloadLink);
			downloadLink.click();
			downloadLink.remove();
			window.URL.revokeObjectURL(blobUrl);
		} catch (error) {
			const message = await getErrorMessageAsync(error, "Xuất kết quả thất bại.");
			setExportError(message);
		} finally {
			setIsExporting(false);
		}
	};

	return (
		<main className={styles.page}>
			<section className={styles.headerCard}>
				<div className={styles.headerTop}>
					<h1>So khớp trên File Excel</h1>
					<button
						type="button"
						className={styles.menuButton}
						onClick={() => router.push("/menu")}
					>
						Về menu
					</button>
				</div>
			</section>

			<section className={styles.uploadSection}>
				<div className={styles.sectionTop}>
					<h2>Nhập file nguồn</h2>
					{canAddMoreSlot && (
						<button
							type="button"
							className={styles.addButton}
							onClick={handleAddSecondSlot}
						>
							+ Thêm file thứ 2
						</button>
					)}
				</div>

				<div className={styles.uploadGrid}>
					{uploadSlots.map((slot) => (
						<article key={slot.id} className={styles.uploadCard}>
							<div className={styles.uploadCardHeader}>
								<h3>File {slot.id}</h3>
								{slot.id === 2 && (
									<button
										type="button"
										className={styles.textButton}
										onClick={handleRemoveSecondSlot}
									>
										Bỏ file 2
									</button>
								)}
							</div>

							<label className={styles.filePickerLabel}>
								<input
									type="file"
									accept=".xlsx,.xls,.csv"
									onChange={(event) => void handleFileChange(slot.id, event)}
									className={styles.fileInput}
								/>
								<span>{slot.fileName ? "Đổi file" : "Chọn file"}</span>
							</label>

							<p className={styles.fileNameText}>
								{slot.fileName || "Chưa có file nào được chọn"}
							</p>

							{slot.loading && <p className={styles.infoText}>Đang phân tích header...</p>}
							{!slot.loading && slot.error && <p className={styles.errorText}>{slot.error}</p>}

							{slot.sheets.length > 0 && (
								<div className={styles.sheetInfo}>
									<p>Đã tải: {slot.sheets.length} sheet</p>
									<ul>
										{slot.sheets.map((sheet) => (
											<li key={`${slot.id}-${sheet.sheetName}`}>
												<strong>{sheet.sheetName}</strong>: {sheet.header.length} cột
											</li>
										))}
									</ul>
								</div>
							)}
						</article>
					))}
				</div>
			</section>

			<section className={styles.mappingSection}>
				<h2>Thiết lập so sánh cột</h2>
				<div className={styles.mappingGrid}>
					<article className={styles.mappingCard}>
						<h3>Bên trái</h3>

						<label>
							File nguồn
							<select
								value={effectiveLeftFileId ?? ""}
								onChange={(event) => {
									const value = Number(event.target.value);
									setLeftFileId(Number.isNaN(value) ? null : value);
									setLeftSheetName("");
									setCompareColumnPairs([createCompareColumnPair(1)]);
								}}
								disabled={uploadedSlots.length === 0}
							>
								{uploadedSlots.length === 0 && <option value="">Chưa có file</option>}
								{uploadedSlots.map((slot) => (
									<option key={`left-file-${slot.id}`} value={slot.id}>
										File {slot.id}: {slot.fileName}
									</option>
								))}
							</select>
						</label>

						<label>
							Sheet
							<select
								value={effectiveLeftSheetName}
								onChange={(event) => {
									setLeftSheetName(event.target.value);
									setCompareColumnPairs([createCompareColumnPair(1)]);
								}}
								disabled={leftSheets.length === 0}
							>
								{leftSheets.length === 0 && <option value="">Chưa có sheet</option>}
								{leftSheets.map((sheet) => (
									<option key={`left-sheet-${sheet.sheetName}`} value={sheet.sheetName}>
										{sheet.sheetName}
									</option>
								))}
							</select>
						</label>

					</article>

					<article className={styles.mappingCard}>
						<h3>Bên phải</h3>

						<label>
							File nguồn
							<select
								value={effectiveRightFileId ?? ""}
								onChange={(event) => {
									const value = Number(event.target.value);
									setRightFileId(Number.isNaN(value) ? null : value);
									setRightSheetName("");
									setCompareColumnPairs([createCompareColumnPair(1)]);
								}}
								disabled={uploadedSlots.length === 0}
							>
								{uploadedSlots.length === 0 && <option value="">Chưa có file</option>}
								{uploadedSlots.map((slot) => (
									<option key={`right-file-${slot.id}`} value={slot.id}>
										File {slot.id}: {slot.fileName}
									</option>
								))}
							</select>
						</label>

						<label>
							Sheet
							<select
								value={effectiveRightSheetName}
								onChange={(event) => {
									setRightSheetName(event.target.value);
									setCompareColumnPairs([createCompareColumnPair(1)]);
								}}
								disabled={rightSheets.length === 0}
							>
								{rightSheets.length === 0 && <option value="">Chưa có sheet</option>}
								{rightSheets.map((sheet) => (
									<option key={`right-sheet-${sheet.sheetName}`} value={sheet.sheetName}>
										{sheet.sheetName}
									</option>
								))}
							</select>
						</label>

					</article>
				</div>

				<div className={styles.columnPairSection}>
					<div className={styles.columnPairHeader}>
						<h3>Danh sách cột so sánh</h3>
						<button
							type="button"
							className={styles.addColumnButton}
							onClick={handleAddColumnPair}
							disabled={!canAddColumnPair}
						>
							+ Thêm cột
						</button>
					</div>

					<div className={styles.columnPairList}>
						{effectiveComparePairs.map((pair, index) => (
							<div key={pair.id} className={styles.columnPairRow}>
								{(() => {
									const availableLeftHeaders = getAvailableHeadersForPair(pair.id, "left");
									const availableRightHeaders = getAvailableHeadersForPair(pair.id, "right");

									return (
										<>
								<span className={styles.pairIndex}>Cặp {index + 1}</span>
								<select
									value={pair.leftColumn}
									onChange={(event) => updateColumnPair(pair.id, "left", event.target.value)}
									disabled={availableLeftHeaders.length === 0}
								>
									<option value="">Chọn cột bên trái</option>
									{availableLeftHeaders.map((header) => (
										<option key={`left-col-${pair.id}-${header}`} value={header}>
											{header}
										</option>
									))}
								</select>
								<span className={styles.arrow}>↔</span>
								<select
									value={pair.rightColumn}
									onChange={(event) => updateColumnPair(pair.id, "right", event.target.value)}
									disabled={availableRightHeaders.length === 0}
								>
									<option value="">Chọn cột bên phải</option>
									{availableRightHeaders.map((header) => (
										<option key={`right-col-${pair.id}-${header}`} value={header}>
											{header}
										</option>
									))}
								</select>
								<label className={styles.likeCheckbox}>
									<input
										type="checkbox"
										checked={pair.like}
										onChange={(event) => updateColumnPairLike(pair.id, event.target.checked)}
									/>
									<span>Gần giống</span>
								</label>
								{compareColumnPairs.length > 1 && (
									<button
										type="button"
										className={styles.removePairButton}
										onClick={() => handleRemoveColumnPair(pair.id)}
									>
										Xóa
									</button>
								)}
										</>
									);
								})()}
							</div>
						))}
					</div>
				</div>

				<div className={styles.summaryBox}>
					<p><strong>Ghép so sánh:</strong></p>
					{completedPairs.length > 0 ? (
						<ul className={styles.summaryList}>
							{completedPairs.map((pair, index) => (
								<li key={`summary-${pair.id}`}>
									Cặp {index + 1}: [{effectiveLeftSheetName || "-"}] {pair.leftColumn} ↔ [{effectiveRightSheetName || "-"}] {pair.rightColumn}{pair.like ? " (Gần giống)" : ""}
								</li>
							))}
						</ul>
					) : (
						<p className={styles.hintText}>Chưa có cặp cột hoàn chỉnh để so sánh.</p>
					)}
					{hasIncompletePair && (
						<p className={styles.hintText}>Có cặp cột chưa chọn đủ 2 bên, vui lòng chọn thêm.</p>
					)}
					{!canCompare && (
						<p className={styles.hintText}>
							Cần chọn đủ file/sheet/cột ở cả hai bên trước khi chạy so sánh.
						</p>
					)}
					{uploadedSlots.length === 1 && (
						<p className={styles.hintText}>
							Bạn đang dùng 1 file, có thể chọn 2 sheet khác nhau để so sánh chéo trong cùng file.
						</p>
					)}

					<div className={styles.compareActionRow}>
						<button
							type="button"
							className={styles.compareButton}
							onClick={() => void handleCompareFiles()}
							disabled={!canCompare || isComparing}
						>
							{isComparing ? "Đang so sánh..." : "So sánh"}
						</button>
						<button
							type="button"
							className={styles.exportButton}
							onClick={() => void handleExportCompareResult()}
							disabled={!canExport || isExporting}
						>
							{isExporting ? "Đang xuất..." : "Xuất kết quả"}
						</button>
					</div>

					{Boolean(compareRecord) && (
						<p className={styles.exportHintText}>
							{isExportWindowActive
								? `Xuất kết quả còn hiệu lực trong ${exportCountdownText}.`
								: "Xuất kết quả đã hết hạn sau 5 phút kể từ lần so sánh gần nhất."}
						</p>
					)}

					{compareError && <p className={styles.compareErrorText}>{compareError}</p>}
					{exportError && <p className={styles.compareErrorText}>{exportError}</p>}
					{compareResult !== null && (
						<div className={styles.compareResultBox}>
							{normalizedCompareResult ? (
								<>
									<div className={styles.compareResultHeader}>
										<p><strong>Kết quả đối soát:</strong></p>
										<p className={styles.compareResultSummary}>
											Bên trái có {leftUnmatchedRows.length} dòng chưa khớp, bên phải có {rightUnmatchedRows.length} dòng chưa khớp.
										</p>
									</div>

									<div className={styles.compareResultGrid}>
										<article className={styles.compareSideCard}>
											<div className={styles.compareSideHeader}>
												<h4>Không khớp bên trái</h4>
												<span>{leftUnmatchedRows.length} dòng</span>
											</div>
											{leftSourceDescription && (
												<p className={styles.compareSideMeta}>{leftSourceDescription}</p>
											)}
											{leftUnmatchedRows.length > 0 ? (
												<div
												    ref={dragLeft.ref}
												    className={styles.mismatchTableWrap}
												    onMouseDown={dragLeft.onMouseDown}
												    onMouseMove={dragLeft.onMouseMove}
												    onMouseUp={dragLeft.onMouseUp}
												    onMouseLeave={dragLeft.onMouseLeave}
												>
													<table className={styles.mismatchTable}>
														<thead>
															<tr>
																<th className={styles.mismatchTh}>#</th>
																{leftResultColumns.map((col) => (
																	<th key={col} className={styles.mismatchTh}>{col}</th>
																))}
															</tr>
														</thead>
														<tbody>
															{leftUnmatchedRows.map((row, index) => (
																<tr key={`left-mismatch-${index}`}>
																	<td className={styles.mismatchIndexTd}>{index + 1}</td>
																	{leftResultColumns.map((col) => (
																		<td key={col} className={styles.mismatchTd}>
																			{row[col] !== undefined && row[col] !== null && row[col] !== "" ? String(row[col]) : "-"}
																		</td>
																	))}
																</tr>
															))}
														</tbody>
													</table>
												</div>
											) : (
												<p className={styles.compareEmptyText}>Không có dòng lỗi ở bên trái.</p>
											)}
										</article>

										<article className={styles.compareSideCard}>
											<div className={styles.compareSideHeader}>
												<h4>Không khớp bên phải</h4>
												<span>{rightUnmatchedRows.length} dòng</span>
											</div>
											{rightSourceDescription && (
												<p className={styles.compareSideMeta}>{rightSourceDescription}</p>
											)}
											{rightUnmatchedRows.length > 0 ? (
												<div
												    ref={dragRight.ref}
												    className={styles.mismatchTableWrap}
												    onMouseDown={dragRight.onMouseDown}
												    onMouseMove={dragRight.onMouseMove}
												    onMouseUp={dragRight.onMouseUp}
												    onMouseLeave={dragRight.onMouseLeave}
												>
													<table className={styles.mismatchTable}>
														<thead>
															<tr>
																<th className={styles.mismatchTh}>#</th>
																{rightResultColumns.map((col) => (
																	<th key={col} className={styles.mismatchTh}>{col}</th>
																))}
															</tr>
														</thead>
														<tbody>
															{rightUnmatchedRows.map((row, index) => (
																<tr key={`right-mismatch-${index}`}>
																	<td className={styles.mismatchIndexTd}>{index + 1}</td>
																	{rightResultColumns.map((col) => (
																		<td key={col} className={styles.mismatchTd}>
																			{row[col] !== undefined && row[col] !== null && row[col] !== "" ? String(row[col]) : "-"}
																		</td>
																	))}
																</tr>
															))}
														</tbody>
													</table>
												</div>
											) : (
												<p className={styles.compareEmptyText}>Không có dòng lỗi ở bên phải.</p>
											)}
										</article>
									</div>
								</>
							) : (
								<>
									<p><strong>Kết quả API:</strong></p>
									<pre>{JSON.stringify(compareResult, null, 2)}</pre>
								</>
							)}
						</div>
					)}
				</div>
			</section>
		</main>
	);
}
