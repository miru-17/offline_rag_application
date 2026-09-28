from app.services.context_builder import ContextBuilder


def main():

    results = {
        "documents": [
            [
                "Mirudhula K\nPython, React, JavaScript",
                "MediPredict and RentEdge projects",
                "M.Sc. Integrated Information Technology"
            ]
        ],
        "metadatas": [
            [
                {
                    "filename": "resume.pdf",
                    "chunk_index": 0
                },
                {
                    "filename": "resume.pdf",
                    "chunk_index": 1
                },
                {
                    "filename": "resume.pdf",
                    "chunk_index": 2
                }
            ]
        ]
    }

    builder = ContextBuilder()

    context = builder.build_context(results)

    print("=" * 60)
    print("GENERATED CONTEXT")
    print("=" * 60)
    print(context)


if __name__ == "__main__":
    main()