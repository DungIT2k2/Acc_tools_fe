"use client";

import { type ChangeEvent, useEffect, useMemo, useState } from "react";
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

export default function FileComparePage() {
	const router = useRouter();
	const [uploadSlots, setUploadSlots] = useState<UploadSlotState[]>([createUploadSlot(1)]);
	const [leftFileId, setLeftFileId] = useState<number | null>(1);
	const [rightFileId, setRightFileId] = useState<number | null>(1);
	const [leftSheetName, setLeftSheetName] = useState("");
	const [rightSheetName, setRightSheetName] = useState("");
	const [compareColumnPairs, setCompareColumnPairs] = useState<CompareColumnPair[]>([createCompareColumnPair(1)]);
	const [isComparing, setIsComparing] = useState(false);
	const [compareError, setCompareError] = useState("");
	const [compareResult, setCompareResult] = useState<unknown>(null);

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
	};

	const handleRemoveColumnPair = (pairId: number) => {
		setCompareColumnPairs((prev) => {
			if (prev.length === 1) {
				return prev;
			}

			return prev.filter((pair) => pair.id !== pairId);
		});
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

	const handleCompareFiles = async () => {
		if (!canCompare || !leftSlot?.file || !rightSlot?.file) {
			setCompareError("Thiếu dữ liệu để so sánh.");
			return;
		}

		try {
			setIsComparing(true);
			setCompareError("");
			setCompareResult(null);

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
				})),
			};

			formData.append("condition", JSON.stringify(condition));

			const response = await callApi.post<unknown>("/file/compareFile", formData, {
				headers: {
					"Content-Type": "multipart/form-data",
				},
			});

			setCompareResult(response.data);
		} catch (error) {
			const message = await getErrorMessageAsync(error, "So sánh file thất bại.");
			setCompareError(message);
		} finally {
			setIsComparing(false);
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
									Cặp {index + 1}: [{effectiveLeftSheetName || "-"}] {pair.leftColumn} ↔ [{effectiveRightSheetName || "-"}] {pair.rightColumn}
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
					</div>

					{compareError && <p className={styles.compareErrorText}>{compareError}</p>}
					{compareResult !== null && (
						<div className={styles.compareResultBox}>
							<p><strong>Kết quả API:</strong></p>
							<pre>{JSON.stringify(compareResult, null, 2)}</pre>
						</div>
					)}
				</div>
			</section>
		</main>
	);
}
