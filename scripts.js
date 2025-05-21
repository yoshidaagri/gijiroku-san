function listFiles(event) {
    // console.log("[DEBUG] listFiles called.");
    const files = event.target.files;
    const fileListContainer = document.getElementById("file-list-container");
    fileListContainer.innerHTML = ""; // リストをクリア

    // ファイルリストを配列に変換してソート
    const fileList = Array.from(files).sort((a, b) => {
        const textA = a.webkitRelativePath || a.name;
        const textB = b.webkitRelativePath || b.name;
        return textA.localeCompare(textB);
    });

    // console.log("[DEBUG] Sorted fileList:", fileList.map(f => f.name));

    for (const file of fileList) {
        const listItem = document.createElement("div");
        listItem.className = "file-item";
        // フルパスを表示するためにfile.webkitRelativePathを使用
        listItem.textContent = file.webkitRelativePath || file.name;
        listItem.onclick = () => {
            // console.log("[DEBUG] listItem clicked:", file.name);
            loadFile(file);
        };
        fileListContainer.appendChild(listItem);
    }
}

function loadFile(file) {
    // console.log("[DEBUG] loadFile called with file:", file.name);
    // ▼▼▼ バグ修正：FileReaderを2つ用いるようにし、onloadを上書きしない形へ修正 ▼▼▼
    const reader = new FileReader();
    reader.onload = function (e) {
        // console.log("[DEBUG] Initial FileReader onload for ArrayBuffer:", file.name);
        const arrayBuffer = e.target.result;
        const uint8Array = new Uint8Array(arrayBuffer);

        // ファイルのエンコーディングを検出
        const detectedEncoding = Encoding.detect(uint8Array);
        // console.log("[DEBUG] Detected encoding:", detectedEncoding, "for file:", file.name);

        // 新処理：別のFileReaderを用いてテキスト読み込みを行う
        const readerText = new FileReader();
        readerText.onload = function (e) {
            // console.log("[DEBUG] Second FileReader onload (readAsText):", file.name);
            let fileContent = e.target.result;
            const blocks = fileContent.split("★★★★★");
            // console.log("[DEBUG] File content blocks:", blocks.length, "blocks.");

            document.getElementById("description").innerText = blocks[1] ? blocks[1].trim() : "";
            document.getElementById("input-files").innerText = blocks[2] ? blocks[2].trim() : "";
            document.getElementById("selected-file").textContent = file.name;
        };
        readerText.readAsText(file, detectedEncoding);
    };
    reader.onerror = function (err) {
        console.error("[DEBUG] Error in loadFile (ArrayBuffer phase):", err);
    };
    reader.readAsArrayBuffer(file);
    // ▲▲▲ バグ修正ここまで ▲▲▲
}

function dropHandler(event) {
    // console.log("[DEBUG] dropHandler called.");
    event.preventDefault();
    const files = event.dataTransfer.files;
    const droppedFiles = document.getElementById("dropped-files");
    for (const file of files) {
        // console.log("[DEBUG] File dropped:", file.name);
        const listItem = document.createElement("div");
        listItem.className = "file-item";
        listItem.textContent = file.name;
        listItem.file = file; // fileオブジェクトを要素に紐付ける
        const deleteBtn = document.createElement("span");
        deleteBtn.textContent = " [削除]";
        deleteBtn.className = "delete-btn";
        deleteBtn.onclick = function () {
            // console.log("[DEBUG] Delete clicked for:", file.name);
            droppedFiles.removeChild(listItem);
        };
        listItem.appendChild(deleteBtn);
        droppedFiles.appendChild(listItem);
    }
}

function dragOverHandler(event) {
    event.preventDefault();
    // console.log("[DEBUG] dragOverHandler called.");
}

// ファイル拡張子判定関数（VTTファイルのみ残す）
function isVTTFile(file) {
    return /\.vtt$/i.test(file.name);
}

// 議事録詳細度を返す関数
function getDetailLevel(level) {
    const detailLevels = {
        "full": "📝 *議事* は**全文**です。トランスクリプトを構造化し、（発言者・タイムスタンプ）を保持したまま出力してください。議事録名は「議事全文」",
        "summary": "📝 *議事* は**要約**です。議題ごとに見出しを付け、3〜5 行で要約してください。議事録名は「議事要約」",
        "points": "📝 *議事* は**要点のみ**です。重要キーワード／決定事項／次アクションだけを1～2行で箇条書きで列挙してください。議事録名は「議事要点のみ」"
    };
    return detailLevels[level] || detailLevels["summary"];
}

// 決定事項の含め方を返す関数
function getDecisionsPrompt(include) {
    return include === "yes" ? 
        "✅ *決定事項* セクションを必ず含め、決定内容／責任者／期限の順で箇条書きしてください" : 
        "✅ *決定事項* セクションは作成しないでください";
}

// 課題事項の含め方を返す関数
function getTasksPrompt(include) {
    return include === "yes" ? 
        "⚠️ *課題事項* セクションを含め、未解決課題と対応オーナーを列挙してください" : 
        "⚠️ *課題事項* セクションは省略してください";
}

// 問題事項の含め方を返す関数
function getIssuesPrompt(include) {
    return include === "yes" ? 
        "❗ *問題事項* セクションを含め、発生中のトラブル・リスクを要約してください" : 
        "❗ *問題事項* セクションは省略してください";
}

// 役職に基づいた出力レベルを返す関数
function getPositionLevel(position) {
    const positionLevels = {
        "none": "", // 指定なし
        "executive": "👤 **読み手は経営陣**です。戦略的意義・意思決定ポイントを強調し、専門用語の解説は不要です", // 経営陣
        "manager": "👤 **読み手は部課長**です。組織への影響とリソース配分を明確に示してください", // 部課長
        "pl": "👤 **読み手はプロジェクトリーダー**です。タスク進行と依存関係を詳しく書いてください", // PLクラス
        "member": "👤 **読み手はメンバー**です。具体的な担当タスクと次のアクションを明確にしてください", // メンバー
        "customer": "👤 **読み手は顧客**です。専門用語を避け、ビジネス価値と成果物を中心に説明してください" // 顧客
    };
    return positionLevels[position] || "";
}

// 自由入力の処理関数
function getCustomPrompt(text) {
    if (!text || text.trim() === "") return "";
    return `👀 追加要件: ${text} を必ず反映してください`;
}

// 議事録監査プロンプトを生成する関数
function generateAuditPrompt() {
    let auditPrompt = "";
    
    // 共通プロンプト
    const commonPrompt = `
- 議事録監査は議事録の最後尾に追加してください
- 指摘と提案は、可能であれば 根拠となる発言（引用）を添付してください。  
- 行数・語数の制限は不要ですが、簡潔さを優先してください。`;
    
    // 各チェックボックスの状態を確認
    const auditPreparation = document.getElementById("audit-preparation").checked;
    const auditFacilitator = document.getElementById("audit-facilitator").checked;
    const auditImportantPoints = document.getElementById("audit-important-points").checked;
    const auditActionItems = document.getElementById("audit-action-items").checked;
    
    // 監査プロンプトを構築
    if (auditPreparation || auditFacilitator || auditImportantPoints || auditActionItems) {
        auditPrompt += "\n\n# 議事録監査要件\n";
        auditPrompt += commonPrompt;
        
        if (auditPreparation) {
            auditPrompt += `\n\n1. 会議の準備改善
会議が「整理されていなかった箇所」を検出し、次回準備を改善する。
- **議題逸脱**: 議題と無関係な話題に 2 分以上 / 3 回以上費やしている  
- **混乱ワード**: 「何の話？」「一度整理しよう」などのフレーズ  
- **ループ**: 同一トピックへ 2 回以上戻る  
- **結論未到達**: 決定語（決めよう／決めた／わかりました等）が無いまま 5 分以上経過
特定された問題点に対して、次回の会議でより効果的な準備をするための具体的な提案をしてください。例：
- 事前に配布すべき資料
- 事前に合意しておくべきポイント
- より明確な議題設定方法`;
        }
        
        if (auditFacilitator) {
            auditPrompt += `\n\n2. ファシリテーター改善
この会議のファシリテーターのパフォーマンスを評価し、改善ポイントを特定してください。以下の点に注目してください：
- 時間管理（各議題に適切な時間を割り当てたか）
- 議論の方向性維持（脱線を防ぎ、主題に戻す能力）
- 全参加者からの意見引き出し（特定の人だけが話していないか）
- 意見の要約と明確化（議論のポイントを適切にまとめたか）
- 決定事項の確認（結論や次のステップを明確にしたか）
改善のための具体的なアドバイスと、効果的なファシリテーションの例を提供してください。`;
        }
        
        if (auditImportantPoints) {
            auditPrompt += `\n\n3. 重要ポイント確認
この会議で議論されるべき重要ポイントが見落とされていないか確認してください。以下を分析してください：
- 議題として設定されていたが議論されなかった項目
- 会議中に「重要」「必須」「優先」などと表現されたが十分に掘り下げられなかった話題
- 「次回に持ち越す」と言われたが、実際には結論が必要な項目
- 言及されたが具体的なアクションや決定に至らなかった重要事項
見落とされたポイントを列挙し、それらをフォローアップするための提案をしてください。`;
        }
        
        if (auditActionItems) {
            auditPrompt += `\n\n4. アクションアイテム明確化
この会議で決定されたアクションアイテム（タスク）を特定し、その明確さと割り当ての適切さを評価してください。以下の点を検証します：
- すべてのアクションアイテムに担当者が明確に割り当てられているか
- 期限が設定されているか
- タスクの内容が具体的かつ測定可能か
- フォローアップの方法が決まっているか
- 複数の担当者がいる場合、責任範囲が明確か
不明確または不完全なアクションアイテムを特定し、それらをより効果的にするための改善案を提示してください。これにより、会議後の実行力と accountability（説明責任）が向上します。`;
        }
    }
    
    return auditPrompt;
}

// 議事録パラメータに基づいてプロンプトを生成する関数
function generatePrompt() {
    // プロンプトの先頭に追加するテキスト
    const introText = `あなたはプロの「議事録作成 AI アシスタント」です。  
入力される Microsoft Teams  会議のトランスクリプト（VTT 形式）は  
\`\`\`<TRANSCRIPT_START> … <TRANSCRIPT_END>\`\`\` で囲まれています。  
### 使命
1. 指定された出力パラメータに従い、読み手に最適化された議事録を作成する  
2. 事実と発言内容を忠実にまとめ、脚色や推測は加えない  
3. 日本語で出力する（専門語や固有名詞は原文を尊重）  
----\n\n`;
    
    // パラメータを取得
    const gijiroku = document.getElementById("param-gijiroku").value;
    const decisions = document.getElementById("param-decisions").value;
    const tasks = document.getElementById("param-tasks").value;
    const issues = document.getElementById("param-issues").value;
    const position = document.getElementById("param-position").value;
    const custom = document.getElementById("param-custom").value;
    
    // 基本プロンプト (先頭テキストを追加)
    let prompt = introText + `以下のTeamsの会議トランスクリプトから議事録を作成してください。である調でまとめてください。\n\n`;
    
    // 出力パラメータ
    prompt += `${getDetailLevel(gijiroku)}\n`;
    prompt += `${getDecisionsPrompt(decisions)}\n`;
    prompt += `${getTasksPrompt(tasks)}\n`;
    prompt += `${getIssuesPrompt(issues)}\n`;
    
    // 役職を追加（値がある場合のみ）
    const positionPrompt = getPositionLevel(position);
    if (positionPrompt) {
        prompt += `${positionPrompt}\n`;
    }
    
    // カスタム要求があれば追加
    if (custom && custom.trim() !== "") {
        prompt += `${getCustomPrompt(custom)}\n`;
    }
    
    // 議事録監査プロンプトがあれば追加
    const auditPrompt = generateAuditPrompt();
    if (auditPrompt) {
        prompt += auditPrompt;
    }
    
    prompt += "\n以下のトランスクリプトを基に、上記の要件に合わせた議事録を作成してください。\n";
    
    return prompt;
}

// VTTファイルを解析する関数
function parseVTTFile(content) {
    const lines = content.split(/\r?\n/);
    let transcript = [];
    let currentSpeaker = "";
    let currentText = "";
    
    // VTTファイルの解析
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // 空行をスキップ
        if (line === "") continue;
        
        // VTTヘッダーとキューの情報をスキップ
        if (line === "WEBVTT" || line.match(/^[0-9:.>-]+$/)) continue;
        
        // 話者情報があるか確認 (例: <v 話者名>テキスト</v>)
        const speakerMatch = line.match(/<v\s+([^>]+)>(.+)<\/v>/);
        if (speakerMatch) {
            // 新しい話者が見つかった場合、前の話者のテキストを保存
            if (currentSpeaker && currentText) {
                transcript.push({ speaker: currentSpeaker, text: currentText.trim() });
                currentText = "";
            }
            
            currentSpeaker = speakerMatch[1].trim();
            currentText = speakerMatch[2].trim();
            
            // 同じ行で話者とテキストが終わる場合は保存
            transcript.push({ speaker: currentSpeaker, text: currentText });
            currentSpeaker = "";
            currentText = "";
        } 
        // 話者タグなしのテキスト行
        else if (!line.match(/^[0-9:.>-]+$/) && !line.match(/^f[0-9a-f-]+\/[0-9-]+$/)) {
            // 現在の話者がいる場合は追加
            if (currentSpeaker) {
                currentText += " " + line;
            } else {
                // 話者が設定されていない場合でもテキストを記録
                transcript.push({ speaker: "Unknown", text: line });
            }
        }
    }
    
    // 最後の発言を保存
    if (currentSpeaker && currentText) {
        transcript.push({ speaker: currentSpeaker, text: currentText.trim() });
    }
    
    // 発言をテキストに整形
    let result = "";
    let prevSpeaker = "";
    for (const item of transcript) {
        if (item.speaker !== prevSpeaker) {
            result += `\n${item.speaker}: ${item.text}`;
            prevSpeaker = item.speaker;
        } else {
            result += ` ${item.text}`;
        }
    }
    
    return result.trim();
}

// ▼▼▼ copyToClipboard: ドロップされたVTTファイルの読込結果をすべて連結してコピー ▼▼▼
function copyToClipboard() {
    // console.log("[DEBUG] copyToClipboard called.");

    // 生成されたプロンプトを取得
    const prompt = generatePrompt();
    const finalPrompt = prompt;
    
    // ●●●が含まれる場合は処理を中止
    if (finalPrompt.includes("●●●")) {
        alert("プロンプトの「●●●」の部分を書き換えてください。");
        return;
    }
    
    const allContent = [finalPrompt];
    const droppedFiles = document.querySelectorAll("#dropped-files .file-item");
    let filesToRead = droppedFiles.length;
    let vttFileCount = 0;
    
    // console.log("[DEBUG] filesToRead:", filesToRead);

    if (filesToRead === 0) {
        // VTTファイルがない場合は処理を中止
        alert("VTTファイルをアップロードしてください。");
        return;
    } else {
        // トランスクリプトデータを格納する配列
        let transcriptContent = [];
        
        droppedFiles.forEach((item) => {
            const file = item.file;
            // console.log("[DEBUG] Processing dropped file:", file.name);

            // VTTファイルのみ処理
            if (isVTTFile(file)) {
                vttFileCount++;
                // VTTファイルの処理
                const reader = new FileReader();
                reader.readAsText(file);
                reader.onload = function (e) {
                    const fileContent = e.target.result;
                    const parsedContent = parseVTTFile(fileContent);
                    transcriptContent.push("");
                    transcriptContent.push(`${file.name} (トランスクリプト)`);
                    transcriptContent.push("");
                    transcriptContent.push(parsedContent);
                    filesToRead--;
                    if (filesToRead === 0) {
                        if (vttFileCount > 0) {
                            // トランスクリプトをTRANSCRIPT_STARTとTRANSCRIPT_ENDで囲む
                            const transcriptWrapped = "\n<TRANSCRIPT_START>\n" + transcriptContent.join("\n") + "\n<TRANSCRIPT_END>\n";
                            copyText(finalPrompt + transcriptWrapped);
                        } else {
                            alert("VTTファイルが含まれていません。アップロードしてください。");
                        }
                    }
                };
                reader.onerror = function (err) {
                    console.error("[DEBUG] Error reading VTT file:", err);
                    filesToRead--;
                    if (filesToRead === 0) {
                        if (vttFileCount > 0) {
                            // トランスクリプトをTRANSCRIPT_STARTとTRANSCRIPT_ENDで囲む
                            const transcriptWrapped = "\n<TRANSCRIPT_START>\n" + transcriptContent.join("\n") + "\n<TRANSCRIPT_END>\n";
                            copyText(finalPrompt + transcriptWrapped);
                        } else {
                            alert("VTTファイルが含まれていません。アップロードしてください。");
                        }
                    }
                };
            } else {
                // VTT以外のファイルはスキップ
                alert(`${file.name} はVTT形式ではありません。スキップします。`);
                filesToRead--;
                if (filesToRead === 0) {
                    if (vttFileCount > 0) {
                        // トランスクリプトをTRANSCRIPT_STARTとTRANSCRIPT_ENDで囲む
                        const transcriptWrapped = "\n<TRANSCRIPT_START>\n" + transcriptContent.join("\n") + "\n<TRANSCRIPT_END>\n";
                        copyText(finalPrompt + transcriptWrapped);
                    } else {
                        alert("VTTファイルが含まれていません。アップロードしてください。");
                    }
                }
            }
        });
    }
}

// ▼▼▼ copyText: テキストをクリップボードにコピーし、Chat AI を開く ▼▼▼
function copyText(text) {
    const footer = `\n\n以上がインプット情報です。冒頭の指示に従ってください。\n\n`;
    let finalText = text + footer;

    // ▼▼▼ ここから追加：ハードコーディングされた置換処理 ▼▼▼
    const replacements = [
        { before: "置換前ワード1", after: "置換後ワード1" },
        { before: "置換前ワード2", after: "置換後ワード2" }
        // 必要な分だけ追加
    ];
    for (const { before, after } of replacements) {
        // 全ての出現箇所を置換
        finalText = finalText.split(before).join(after);
    }
    // ▲▲▲ 置換処理ここまで ▲▲▲

    // console.log("[DEBUG] copyText called. Final text length:", finalText.length);
    navigator.clipboard.writeText(finalText).then(
        function () {
            // console.log("[DEBUG] Successfully copied text to clipboard. Opening Chat AI.");
            window.open("ここにお好みの生成AIのURL", "_blank");
        },
        function () {
            alert("コピーに失敗しました！");
        }
    );
}

// ▼▼▼ クリアボタンで初期化 ▼▼▼
function clearAll() {
    // console.log("[DEBUG] clearAll called.");
    document.getElementById("dropped-files").innerHTML = "";
    document.querySelector('input[type="file"]').value = "";
    document.getElementById("selected-file").textContent = "";
    document.getElementById("description").innerText = "";
    document.getElementById("input-files").innerText = "";
    document.getElementById("param-custom").value = "";
    // パラメータをデフォルト値に戻す
    document.getElementById("param-gijiroku").value = "summary";
    document.getElementById("param-decisions").value = "yes";
    document.getElementById("param-tasks").value = "yes";
    document.getElementById("param-issues").value = "yes";
    document.getElementById("param-position").value = "none";
    
    // 監査チェックボックスをリセット
    document.getElementById("audit-preparation").checked = false;
    document.getElementById("audit-facilitator").checked = false;
    document.getElementById("audit-important-points").checked = false;
    document.getElementById("audit-action-items").checked = false;
}
