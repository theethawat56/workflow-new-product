/**
 * Dataslot WFM search client — KOL post submissions.
 * Public read endpoint; no API key required as of 2026-07.
 */

const DATASLOT_SEARCH_URL =
    "https://open-api.dataslot.app/search/wfm/v1/RobotMaker"

export interface DataslotKolHit {
    taskNumber: string
    workflowId?: string
    status?: string
    ref1?: string
    ref2?: string
    timestamp?: number
    detail?: {
        kolInfo?: { kolName?: string; platformAccount?: string }
        postInfo?: { postDate?: number; platform?: string; postUrl?: string }
        budgetInfo?: { budgetType?: string; budgetAmount?: number }
        engagement?: { views?: number; likes?: number; saved?: number }
        featuredProducts?: Array<{ sku?: string; name?: string; quantity?: number }>
    }
}

export interface DataslotSearchResponse {
    hits: DataslotKolHit[]
    totalHits: number
    totalPages: number
    hitsPerPage: number
}

export async function fetchKolSubmissionsPage(
    page: number,
    hitsPerPage = 500,
): Promise<DataslotSearchResponse> {
    const res = await fetch(DATASLOT_SEARCH_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify({
            hitsPerPage,
            page,
            filter: ["company = RobotMaker", "workflowId=KOL_POST_SUBMISSION"],
            sort: ["timestamp:desc"],
        }),
        cache: "no-store",
    })

    if (!res.ok) {
        const body = await res.text().catch(() => "")
        throw new Error(`Dataslot API ${res.status}: ${body.slice(0, 300)}`)
    }

    return res.json() as Promise<DataslotSearchResponse>
}

/** Paginate through all KOL_POST_SUBMISSION records. */
export async function fetchAllKolSubmissions(
    onProgress?: (msg: string) => void,
): Promise<DataslotKolHit[]> {
    const all: DataslotKolHit[] = []
    let page = 1
    let totalPages = 1

    while (page <= totalPages) {
        const data = await fetchKolSubmissionsPage(page)
        totalPages = data.totalPages ?? 1
        const hits = data.hits ?? []
        all.push(...hits)
        onProgress?.(`Fetched page ${page}/${totalPages} (${hits.length} hits)`)
        page++
    }

    return all
}
